import { json, error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { env } from '$env/dynamic/private';
import {
  requireAuthenticatedUser,
  requireAuctionAccess
} from '$lib/server/authorization.js';

async function cleanupWithAI({ title, description, hebrewTitle, hebrewDescription, images = [] }) {
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
        text: `You are a helpful assistant that cleans up and organizes auction lot information for fine art, antiques, and collectibles, especially Judaica items. Extract and organize information into proper fields including English and Hebrew titles/descriptions, and dates.`
      }
    ];

    // Build the prompt with all current information
    let prompt = `Please clean up and organize the following auction lot information. Extract and format the following fields:\n\n`;
    
    if (title) prompt += `Current Title: ${title}\n`;
    if (description) prompt += `Current Description: ${description}\n`;
    if (hebrewTitle) prompt += `Current Hebrew Title: ${hebrewTitle}\n`;
    if (hebrewDescription) prompt += `Current Hebrew Description: ${hebrewDescription}\n`;
    
    prompt += `\nPlease provide:\n`;
    prompt += `1. A clean, professional English title (concise, max 100 characters)\n`;
    prompt += `2. A clean, professional English description (2-4 paragraphs, well-formatted)\n`;
    prompt += `3. A proper Hebrew title (in Hebrew script, if applicable)\n`;
    prompt += `4. A proper Hebrew description (in Hebrew script, if applicable)\n`;
    prompt += `5. Extract the year/date from the information (English year, e.g., 1920)\n`;
    prompt += `6. Convert the English year to Hebrew year (e.g., תר"פ for 1920)\n\n`;
    
    if (imageAttachments.length > 0) {
      prompt += `Images are attached. Use them to extract visual details, OCR any visible text, maker marks, labels, signatures, dates, and Hebrew text. Use the images to improve and verify all fields.\n\n`;
    }
    
    prompt += `Return the result as JSON with these exact keys: title, description, hebrewTitle, hebrewDescription, yearEnglish, yearHebrew. If a field cannot be determined, use null.`;

    const userContent = [
      {
        type: 'text',
        text: prompt
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
        model: 'gpt-4o-mini',
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
        max_tokens: 1000,
        temperature: 0.3 // Lower temperature for more consistent formatting
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const result = data.choices[0].message.content;
    
    // Try to parse JSON from the result
    try {
      // Try to extract JSON from markdown code blocks if present
      let jsonStr = result;
      const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/) || result.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      
      // Try to find JSON object boundaries
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }
      
      // Clean up common JSON issues
      jsonStr = jsonStr
        .replace(/,\s*}/g, '}') // Remove trailing commas before closing brace
        .replace(/,\s*]/g, ']') // Remove trailing commas before closing bracket
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Ensure property names are quoted
        .replace(/:\s*([^",\[\]{}\s]+)([,}\]])/g, ': "$1"$2') // Quote unquoted string values
        .replace(/:\s*"([^"]*)"([,}\]])/g, ': "$1"$2'); // Ensure string values are properly quoted
      
      const parsed = JSON.parse(jsonStr);
      
      return {
        title: parsed.title || null,
        description: parsed.description || null,
        hebrewTitle: parsed.hebrewTitle || null,
        hebrewDescription: parsed.hebrewDescription || null,
        yearEnglish: parsed.yearEnglish ? String(parsed.yearEnglish) : null,
        yearHebrew: parsed.yearHebrew || null
      };
    } catch (parseError) {
      // If JSON parsing fails, try to extract fields from text
      console.warn('Failed to parse JSON, attempting text extraction:', parseError);
      
      // Try to extract fields using regex patterns (more robust)
      const extracted = {
        title: null,
        description: null,
        hebrewTitle: null,
        hebrewDescription: null,
        yearEnglish: null,
        yearHebrew: null
      };
      
      // Extract title - look for "title": "value" or title: "value" patterns
      const titlePatterns = [
        /"title"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/i,
        /"title"\s*:\s*([^,\n}]+)/i,
        /title\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/i,
        /title\s*:\s*([^\n,}]+)/i
      ];
      for (const pattern of titlePatterns) {
        const match = result.match(pattern);
        if (match && match[1]) {
          extracted.title = match[1].trim().replace(/^["']|["']$/g, '') || null;
          break;
        }
      }
      
      // Extract description - can be multi-line
      const descPatterns = [
        /"description"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/i,
        /"description"\s*:\s*"([^"]*)"/i,
        /description\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/i
      ];
      for (const pattern of descPatterns) {
        const match = result.match(pattern);
        if (match && match[1]) {
          extracted.description = match[1].trim().replace(/\\n/g, '\n') || null;
          break;
        }
      }
      
      // Extract Hebrew title
      const hebrewTitlePatterns = [
        /"hebrewTitle"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/i,
        /"hebrewTitle"\s*:\s*([^,\n}]+)/i,
        /hebrew\s*title\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/i,
        /hebrew\s*title\s*:\s*([^\n,}]+)/i
      ];
      for (const pattern of hebrewTitlePatterns) {
        const match = result.match(pattern);
        if (match && match[1]) {
          extracted.hebrewTitle = match[1].trim().replace(/^["']|["']$/g, '') || null;
          break;
        }
      }
      
      // Extract Hebrew description
      const hebrewDescPatterns = [
        /"hebrewDescription"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/i,
        /"hebrewDescription"\s*:\s*"([^"]*)"/i,
        /hebrew\s*description\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/i
      ];
      for (const pattern of hebrewDescPatterns) {
        const match = result.match(pattern);
        if (match && match[1]) {
          extracted.hebrewDescription = match[1].trim().replace(/\\n/g, '\n') || null;
          break;
        }
      }
      
      // Extract English year
      const yearEnglishMatch = result.match(/"yearEnglish"\s*:\s*"?(\d{4})"?/i) ||
                              result.match(/year\s*\(?english\)?\s*:\s*"?(\d{4})"?/i) ||
                              result.match(/\b(18|19|20)\d{2}\b/);
      if (yearEnglishMatch) {
        extracted.yearEnglish = yearEnglishMatch[1] || yearEnglishMatch[0] || null;
      }
      
      // Extract Hebrew year
      const yearHebrewPatterns = [
        /"yearHebrew"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/i,
        /"yearHebrew"\s*:\s*([^,\n}]+)/i,
        /year\s*\(?hebrew\)?\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/i,
        /year\s*\(?hebrew\)?\s*:\s*([^\n,}]+)/i
      ];
      for (const pattern of yearHebrewPatterns) {
        const match = result.match(pattern);
        if (match && match[1]) {
          extracted.yearHebrew = match[1].trim().replace(/^["']|["']$/g, '') || null;
          break;
        }
      }
      
      return extracted;
    }
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
        images: {
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    if (!lot) {
      throw error(404, 'Lot not found');
    }

    requireAuctionAccess(user, lot.auction);

    const { includeImages = true } = await request.json().catch(() => ({}));

    // Get images if requested
    const selectedImages = includeImages && (lot.images?.length || 0) > 0
      ? Array.from(
          new Set(
            (lot.images || [])
              .map(img => img?.url)
              .filter(url => typeof url === 'string' && url.trim() !== '')
          )
        )
      : [];

    // Clean up with AI
    const cleaned = await cleanupWithAI({
      title: lot.title || '',
      description: lot.description || '',
      hebrewTitle: lot.hebrewTitle || '',
      hebrewDescription: lot.hebrewDescription || '',
      images: selectedImages
    });

    // Update the lot with cleaned data
    const updateData = {};
    if (cleaned.title !== null) updateData.title = cleaned.title;
    if (cleaned.description !== null) updateData.description = cleaned.description;
    if (cleaned.hebrewTitle !== null) updateData.hebrewTitle = cleaned.hebrewTitle;
    if (cleaned.hebrewDescription !== null) updateData.hebrewDescription = cleaned.hebrewDescription;
    
    // Handle year fields in metaFields
    if (cleaned.yearEnglish !== null || cleaned.yearHebrew !== null) {
      let metaFields = {};
      try {
        if (lot.metaFields) {
          metaFields = typeof lot.metaFields === 'string' 
            ? JSON.parse(lot.metaFields) 
            : lot.metaFields;
        }
      } catch (e) {
        metaFields = {};
      }
      
      if (cleaned.yearEnglish !== null) metaFields.yearEnglish = cleaned.yearEnglish;
      if (cleaned.yearHebrew !== null) metaFields.yearHebrew = cleaned.yearHebrew;
      
      updateData.metaFields = Object.keys(metaFields).length > 0 ? JSON.stringify(metaFields) : null;
    }

    // Update the lot
    const updated = await prisma.lot.update({
      where: { id: params.id },
      data: updateData
    });

    // Return cleaned data
    return json({
      title: cleaned.title,
      description: cleaned.description,
      hebrewTitle: cleaned.hebrewTitle,
      hebrewDescription: cleaned.hebrewDescription,
      yearEnglish: cleaned.yearEnglish,
      yearHebrew: cleaned.yearHebrew
    });
  } catch (err) {
    if (err.status) {
      throw err;
    }
    console.error('Error cleaning up with AI:', err);
    throw error(500, err.message || 'Failed to clean up');
  }
}

