import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { requireCurrentUser } from '$lib/server/seller-submissions.js';
import {
  deleteFile,
  getStorageProviderName,
  uploadFile
} from '$lib/services/cloudStorage.js';
import { convertToPresignedUrl } from '$lib/utils/s3Presigned.js';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function detectImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', extension: 'webp' };
  }
  throw error(400, 'Upload a JPEG, PNG, or WebP image');
}

function parseAnalysis(content) {
  try {
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, '').trim());
    return {
      title: typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 200) : '',
      description: typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 10000) : '',
      condition: typeof parsed.condition === 'string' ? parsed.condition.trim().slice(0, 2000) : '',
      category: typeof parsed.category === 'string' ? parsed.category.trim().slice(0, 100) : ''
    };
  } catch {
    throw error(502, 'The image analysis returned an invalid listing draft');
  }
}

async function analyzeWithOpenAI(imageUrl) {
  const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw error(503, 'AI listing creation is not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content: 'You are a careful auction cataloger specializing in Judaica, books, manuscripts, ceremonial objects, art, antiques, and collectibles. Describe only details supported by the image. Never invent provenance, authenticity, age, maker, materials, signatures, or defects. Clearly qualify uncertainty.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Create a seller-editable auction listing draft from this image. Use OCR for visible titles, inscriptions, dates, signatures, labels, or maker marks. Return JSON with exactly these string fields: title, description, condition, category. The condition must separately describe visible wear, damage, completeness, repairs, staining, or uncertainty. Keep the title concise and the description factual.'
            },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
          ]
        }
      ]
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('OpenAI image analysis failed', response.status, result?.error?.message);
    throw error(502, result?.error?.message || 'AI could not analyze the image');
  }
  return parseAnalysis(result.choices?.[0]?.message?.content || '');
}

export async function POST({ request, locals }) {
  await requireCurrentUser(locals);
  if (getStorageProviderName() !== 's3') {
    throw error(503, 'Create from image requires STORAGE_PROVIDER=s3');
  }

  const formData = await request.formData();
  const file = formData.get('image');
  if (!(file instanceof File) || file.size === 0) throw error(400, 'Choose an image to continue');
  if (file.size > MAX_IMAGE_BYTES) throw error(413, 'Images must be 12 MB or smaller');

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImage(buffer);
  let uploaded;
  try {
    uploaded = await uploadFile(buffer, `seller-capture.${detected.extension}`, 'lots', detected.mime);
  } catch (err) {
    throw error(503, `Image storage is unavailable: ${err.message}`);
  }

  try {
    const previewUrl = await convertToPresignedUrl(uploaded.url);
    const listing = await analyzeWithOpenAI(previewUrl);
    return json({
      listing,
      image: { key: uploaded.key, url: uploaded.url, previewUrl }
    }, { status: 201 });
  } catch (err) {
    await deleteFile(uploaded.key, 'lots').catch((cleanupError) => {
      console.error('Failed to clean up image after AI analysis error', cleanupError);
    });
    throw err;
  }
}
