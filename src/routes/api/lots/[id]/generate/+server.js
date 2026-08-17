import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { env } from '$env/dynamic/private';
import {
  requireAuthenticatedUser,
  requireAuctionAccess
} from '$lib/server/authorization.js';

async function generateWithAI({ prompt, contextPrompt = '', images = [] }) {
  const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set. Please add it to your .env file.');
  }

  try {
    const imageAttachments = (images || [])
      .filter(url => typeof url === 'string' && /^https?:\/\//i.test(url))
      .slice(0, 6) // cap to keep prompt size reasonable
      .map(url => ({
        type: 'image_url',
        image_url: { url }
      }));

    const systemContent = [
      {
        type: 'text',
        text: `You are a helpful assistant that generates auction lot titles and descriptions for fine art, antiques, and collectibles. ${contextPrompt ? `Additional context: ${contextPrompt}` : ''}`
      }
    ];

    const userContent = [
      {
        type: 'text',
        text: imageAttachments.length
          ? `${prompt}\n\nImages are attached. Use them to extract visual details and OCR any visible text, maker marks, labels, or signatures. If description fields are empty, rely on what you see. Call out condition issues, materials, style/period, and anything written in the images.`
          : prompt
      },
      ...imageAttachments
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using gpt-4o-mini for cost efficiency, can be changed to gpt-4
        messages: [
          {
            role: 'system',
            content: systemContent
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error('OpenAI API error:', err);
    throw err;
  }
}

export async function POST({ params, request, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);

    const lot = await prisma.lot.findUnique({
      where: { id: params.id },
      include: { 
        auction: { 
          include: { 
            auctionHouse: true 
          } 
        },
        notes: {
          orderBy: { createdAt: 'desc' }
        },
        images: {
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    if (!lot) {
      throw error(404, 'Lot not found');
    }

    requireAuctionAccess(user, lot.auction);

    const { type, context, includeImages = false } = await request.json();

    // Get AI prompts from settings
    const auctionHousePrompt = lot.auction.auctionHouse.settings 
      ? JSON.parse(lot.auction.auctionHouse.settings).aiPrompt || ''
      : '';
    const auctionPrompt = lot.auction.settings
      ? JSON.parse(lot.auction.settings).aiPrompt || ''
      : '';

    const contextPrompt = [auctionHousePrompt, auctionPrompt].filter(Boolean).join(' ');

    // Build prompt based on type and context
    let userPrompt = '';
    const notes = lot.notes.map(n => n.summary || n.transcription || n.content).filter(Boolean).join('\n\n');
    const currentTitle = context?.currentTitle || lot.title || '';
    const currentDescription = context?.currentDescription || lot.description || '';
    const hasImages = (lot.images?.length || 0) > 0;
    const selectedImages = includeImages && hasImages
      ? Array.from(
          new Set(
            (lot.images || [])
              .map(img => img?.url)
              .filter(url => typeof url === 'string' && url.trim() !== '')
          )
        )
      : [];

    if (type === 'title') {
      userPrompt = `Generate a compelling auction lot title based on the following information:\n\n`;
      if (notes) userPrompt += `Notes:\n${notes}\n\n`;
      if (currentTitle) userPrompt += `Current title: ${currentTitle}\n\n`;
      if (selectedImages.length > 0) userPrompt += `Images are attached. Use what you see (including OCR) to improve the title.\n\n`;
      userPrompt += `Generate a concise, professional title (max 100 characters).`;
    } else if (type === 'description') {
      userPrompt = `Generate a detailed auction lot description based on the following information:\n\n`;
      if (notes) userPrompt += `Notes:\n${notes}\n\n`;
      if (currentTitle) userPrompt += `Title: ${currentTitle}\n\n`;
      if (currentDescription) userPrompt += `Current description: ${currentDescription}\n\n`;
      if (selectedImages.length > 0) userPrompt += `Images are attached. Use visual cues and OCR to extract maker marks, labels, signatures, and condition details.\n\n`;
      userPrompt += `Generate a comprehensive, professional description (2-4 paragraphs).`;
    } else if (type === 'both') {
      userPrompt = `Generate both a title and description for an auction lot based on the following information:\n\n`;
      if (notes) userPrompt += `Notes:\n${notes}\n\n`;
      if (currentTitle) userPrompt += `Current title: ${currentTitle}\n\n`;
      if (currentDescription) userPrompt += `Current description: ${currentDescription}\n\n`;
      if (selectedImages.length > 0) userPrompt += `Images are attached. Use them (plus OCR) to inform both the title and description.\n\n`;
      userPrompt += `Generate:\n1. A concise title (max 100 characters)\n2. A comprehensive description (2-4 paragraphs)\n\nFormat as JSON: {"title": "...", "description": "..."}`;
    }

    // Generate with AI
    const result = await generateWithAI({
      prompt: userPrompt,
      contextPrompt,
      images: selectedImages
    });

    // Parse result
    let title, description;
    if (type === 'both') {
      try {
        const parsed = JSON.parse(result);
        title = parsed.title;
        description = parsed.description;
      } catch {
        // If JSON parsing fails, try to extract from text
        const lines = result.split('\n');
        title = lines.find(l => l.toLowerCase().includes('title'))?.replace(/title:?/i, '').trim() || '';
        description = lines.filter(l => !l.toLowerCase().includes('title')).join('\n').trim();
      }
    } else if (type === 'title') {
      title = result.trim();
    } else {
      description = result.trim();
    }

    return json({ title, description });
  } catch (err) {
    if (err.status) {
      throw err;
    }
    console.error('Error generating with AI:', err);
    throw error(500, err.message || 'Failed to generate');
  }
}

