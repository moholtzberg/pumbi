import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { convertToPresignedUrl } from '$lib/utils/s3Presigned.js';
import {
  requireAuthenticatedUser,
  requireAuctionAccess
} from '$lib/server/authorization.js';

export async function GET({ params, locals }) {
  try {
    const user = await requireAuthenticatedUser(locals);

    // Get auction with lots and images
    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: {
        lots: {
          include: {
            images: {
              orderBy: { displayOrder: 'asc' }
            }
          },
          orderBy: { position: 'asc' }
        },
        auctionHouse: true
      }
    });

    requireAuctionAccess(user, auction);

    // CSV Header
    const csvRows = [[
      'Lot Number',
      'Title',
      'Hebrew Title',
      'Description',
      'Hebrew Description',
      'Category',
      'Tags',
      'Starting Bid',
      'Current Bid',
      'Bid Increment',
      'Status',
      'End Time',
      'Is Ready',
      'Watchers Count',
      'Primary Image',
      'Image Count'
    ].join(',')];

    // Download images and prepare for zip
    const imageMap = new Map(); // Map of {lotNumber}-{imageNumber}.ext -> image buffer
    const lotData = []; // Store lot data for CSV generation after images are downloaded
    
    // First pass: Download all images
    for (const lot of auction.lots) {
      // Sort images by displayOrder
      const sortedImages = [...(lot.images || [])].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      
      // Download and rename images
      for (let i = 0; i < sortedImages.length; i++) {
        const img = sortedImages[i];
        const imageNumber = i + 1;
        const imageName = `${lot.lotNumber}-${imageNumber}`;
        
        try {
          // Get presigned URL
          const imageUrl = await convertToPresignedUrl(img.url || img.cloudKey, 3600);
          
          // Download image
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            console.error(`Failed to download image ${img.id}: ${imageResponse.statusText}`);
            continue;
          }
          
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          
          // Determine file extension from content type
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          let ext = 'jpg';
          if (contentType.includes('png')) ext = 'png';
          else if (contentType.includes('gif')) ext = 'gif';
          else if (contentType.includes('webp')) ext = 'webp';
          else if (contentType.includes('jpeg')) ext = 'jpg';
          
          imageMap.set(`${imageName}.${ext}`, imageBuffer);
        } catch (err) {
          console.error(`Error downloading image ${img.id} for lot ${lot.lotNumber}:`, err);
        }
      }
      
      // Store lot data for CSV generation
      lotData.push({
        lot,
        sortedImages
      });
    }
    
    // Second pass: Generate CSV rows (now we can look up primary image names)
    for (const { lot, sortedImages } of lotData) {
      // Get primary image filename
      const primaryImage = sortedImages.find(img => img.isPrimary) || sortedImages[0];
      let primaryImageName = '';
      if (primaryImage && sortedImages.length > 0) {
        const primaryIndex = sortedImages.indexOf(primaryImage);
        const primaryImageNumber = primaryIndex + 1;
        // Find the actual extension from the image map
        for (const key of imageMap.keys()) {
          if (key.startsWith(`${lot.lotNumber}-${primaryImageNumber}.`)) {
            primaryImageName = key;
            break;
          }
        }
        // Fallback if not found
        if (!primaryImageName) {
          primaryImageName = `${lot.lotNumber}-${primaryImageNumber}.jpg`;
        }
      }
      
      // Parse tags and metaFields
      const tags = lot.tags ? (typeof lot.tags === 'string' ? JSON.parse(lot.tags) : lot.tags) : [];
      
      // CSV Row
      const csvRow = [
        lot.lotNumber,
        escapeCsvField(lot.title || ''),
        escapeCsvField(lot.hebrewTitle || ''),
        escapeCsvField(lot.description || ''),
        escapeCsvField(lot.hebrewDescription || ''),
        escapeCsvField(lot.category || ''),
        escapeCsvField(tags.join('; ') || ''),
        lot.startingBid || 0,
        lot.currentBid || 0,
        lot.bidIncrement || 0,
        lot.status || 'ACTIVE',
        lot.endTime ? new Date(lot.endTime).toISOString() : '',
        lot.isReady ? 'Yes' : 'No',
        lot.watchersCount || 0,
        primaryImageName,
        sortedImages.length
      ];
      
      csvRows.push(csvRow.join(','));
    }

    // Dynamic import for archiver (inside function to avoid top-level await)
    let archiverModule;
    try {
      archiverModule = await import('archiver');
    } catch (err) {
      console.error('Archiver not installed. Run: npm install archiver');
      throw error(500, 'Archiver package not installed. Please run: npm install archiver');
    }
    const archiver = archiverModule.default;

    // Create zip file
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Set up event handlers BEFORE adding files
    const chunks = [];
    archive.on('data', (chunk) => {
      chunks.push(chunk);
    });

    // Add CSV file
    archive.append(csvRows.join('\n'), { name: 'lots.csv' });
    
    // Add images to images folder
    for (const [imageName, imageBuffer] of imageMap.entries()) {
      archive.append(imageBuffer, { name: `images/${imageName}` });
    }

    // Finalize the archive and wait for completion
    archive.finalize();
    
    await new Promise((resolve, reject) => {
      archive.on('end', () => {
        resolve();
      });
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        reject(err);
      });
    });

    const zipBuffer = Buffer.concat(chunks);

    // Return zip file
    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="bidspirit-export-${auction.title.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.zip"`
      }
    });
  } catch (err) {
    if (err.status) {
      throw err;
    }
    console.error('Error exporting to BidSpirit:', err);
    throw error(500, err.message || 'Failed to export to BidSpirit');
  }
}

/**
 * Escape CSV field - wrap in quotes if contains comma, quote, or newline
 */
function escapeCsvField(field) {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
