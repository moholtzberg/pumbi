import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { requireCurrentUser } from '$lib/server/seller-submissions.js';
import { uploadFile } from '$lib/services/cloudStorage.js';
import { convertToPresignedUrl } from '$lib/utils/s3Presigned.js';
import { readUploadImage } from '$lib/server/uploadImages.js';
export const config = { maxDuration: 120 };

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
    signal: AbortSignal.timeout(30_000),
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
  const formData = await request.formData();
  const { buffer, mime, extension } = await readUploadImage(formData.get('image'));
  let uploaded;
  try {
    uploaded = await uploadFile(buffer, `seller-capture.${extension}`, 'lots', mime);
  } catch (err) {
    throw error(503, `Image storage is unavailable: ${err.message}`);
  }
  const previewUrl = await convertToPresignedUrl(uploaded.url);
  let listing = null;
  let warning = null;
  try {
    if (!/^https:\/\//.test(previewUrl) || mime === 'image/gif') throw error(503, 'Photo analysis requires a supported remotely accessible image');
    listing = await analyzeWithOpenAI(previewUrl);
  } catch (err) {
    // Upload and catalog entry do not depend on optional AI availability.
    console.warn('Optional listing photo analysis unavailable', err.status || 'unavailable');
    warning = 'Photo uploaded. AI analysis is unavailable; enter the lot details manually.';
  }
  return json({ listing, warning, image: { key: uploaded.key, url: uploaded.url, previewUrl } }, { status: 201 });
}
