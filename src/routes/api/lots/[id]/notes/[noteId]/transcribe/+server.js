import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { getPresignedUrl } from '$lib/services/cloudStorage.js';
import { extractS3Key } from '$lib/utils/s3Presigned.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { env } from '$env/dynamic/private';
import {
  HOUSE_PERMISSIONS,
  requireAuthenticatedUser,
  requireAuctionAccess,
  requireAuctionHousePermission
} from '$lib/server/authorization.js';

async function transcribeAudio(audioUrl) {
  const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set. Please add it to your .env file.');
  }

  try {
    let audioBuffer;
    let fileName = 'audio.webm';
    
    // Check if it's an S3 URL/key
    const s3Key = extractS3Key(audioUrl);
    if (s3Key) {
      // Get presigned URL and fetch the file
      const presignedUrl = await getPresignedUrl(s3Key, 3600);
      const response = await fetch(presignedUrl);
      audioBuffer = Buffer.from(await response.arrayBuffer());
      fileName = s3Key.split('/').pop() || 'audio.webm';
    } else if (audioUrl.startsWith('/uploads/')) {
      // Local file
      const audioPath = join(process.cwd(), audioUrl.replace('/uploads/', 'uploads/'));
      audioBuffer = await readFile(audioPath);
      fileName = audioPath.split('/').pop() || 'audio.webm';
    } else if (audioUrl.startsWith('http')) {
      // External URL (presigned or direct)
      const response = await fetch(audioUrl);
      audioBuffer = Buffer.from(await response.arrayBuffer());
      fileName = audioUrl.split('/').pop() || 'audio.webm';
    } else {
      throw new Error('Invalid audio URL format');
    }
    
    // Create FormData for OpenAI Whisper API
    // Use native FormData (available in Node.js 18+)
    const formData = new FormData();
    
    // Create a Blob from the buffer and append as File
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    const audioFile = new File([audioBlob], fileName, { type: 'audio/webm' });
    
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Optional: specify language
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
        // Don't set Content-Type - fetch will set it automatically with boundary for FormData
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data.text;
  } catch (err) {
    console.error('Transcription error:', err);
    throw err;
  }
}

export async function POST({ params, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);

    const lot = await prisma.lot.findUnique({
      where: { id: params.id },
      include: { auction: { include: { auctionHouse: true } } }
    });

    if (!lot) {
      throw error(404, 'Lot not found');
    }

    requireAuctionAccess(user, lot.auction);
    await requireAuctionHousePermission(
      user,
      lot.auction.auctionHouseId,
      HOUSE_PERMISSIONS.MANAGE_CATALOG
    );

    const note = await prisma.lotNote.findUnique({
      where: { id: params.noteId }
    });

    if (!note || note.lotId !== params.id) {
      throw error(404, 'Note not found');
    }

    if (!note.audioUrl) {
      throw error(400, 'Note has no audio file');
    }

    // Transcribe audio
    const transcription = await transcribeAudio(note.audioUrl);

    // Update note with transcription
    const updated = await prisma.lotNote.update({
      where: { id: params.noteId },
      data: {
        transcription,
        content: transcription // Also set content for display
      }
    });

    return json(updated);
  } catch (err) {
    if (err.status) {
      throw err;
    }
    console.error('Error transcribing audio:', err);
    throw error(500, err.message || 'Failed to transcribe audio');
  }
}

