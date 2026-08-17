import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { env } from '$env/dynamic/private';
import {
  requireAuthenticatedUser,
  requireAuctionAccess
} from '$lib/server/authorization.js';

async function summarizeText(text, contextPrompt = '') {
  const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set. Please add it to your .env file.');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using gpt-4o-mini for cost efficiency
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that summarizes notes about auction lots. ${contextPrompt ? `Additional context: ${contextPrompt}` : ''} Provide concise, informative summaries.`
          },
          {
            role: 'user',
            content: `Please summarize the following note in 2-3 sentences, focusing on key details:\n\n${text}`
          }
        ],
        max_tokens: 200,
        temperature: 0.5
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

export async function POST({ params, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);

    const lot = await prisma.lot.findUnique({
      where: { id: params.id },
      include: { 
        auction: { 
          include: { 
            auctionHouse: true 
          } 
        } 
      }
    });

    if (!lot) {
      throw error(404, 'Lot not found');
    }

    requireAuctionAccess(user, lot.auction);

    const note = await prisma.lotNote.findUnique({
      where: { id: params.noteId }
    });

    if (!note || note.lotId !== params.id) {
      throw error(404, 'Note not found');
    }

    const textToSummarize = note.transcription || note.content;
    if (!textToSummarize) {
      throw error(400, 'Note has no content to summarize');
    }

    // Get AI prompts from settings
    const auctionHousePrompt = lot.auction.auctionHouse.settings 
      ? JSON.parse(lot.auction.auctionHouse.settings).aiPrompt || ''
      : '';
    const auctionPrompt = lot.auction.settings
      ? JSON.parse(lot.auction.settings).aiPrompt || ''
      : '';

    const contextPrompt = [auctionHousePrompt, auctionPrompt].filter(Boolean).join(' ');

    // Generate summary
    const summary = await summarizeText(textToSummarize, contextPrompt);

    // Update note with summary
    const updated = await prisma.lotNote.update({
      where: { id: params.noteId },
      data: { summary }
    });

    return json(updated);
  } catch (err) {
    if (err.status) {
      throw err;
    }
    console.error('Error summarizing note:', err);
    throw error(500, err.message || 'Failed to summarize note');
  }
}

