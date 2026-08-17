import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import prisma from '$lib/prisma.js';
import { deleteFile } from '$lib/services/cloudStorage.js';

export async function GET({ params }) {
  const lot = await db.lots.getById(params.id);
  if (!lot) {
    throw error(404, 'Lot not found');
  }
  return json(lot);
}

export async function PATCH({ params, request }) {
  try {
    const updates = await request.json();
    
    // Get existing lot to merge metaFields if needed
    const existingLot = await db.lots.getById(params.id);
    if (!existingLot) {
      throw error(404, 'Lot not found');
    }
    
    // Handle imageUrls - if it's a string, keep it; if array, stringify it
    if (updates.imageUrls && Array.isArray(updates.imageUrls)) {
      updates.imageUrls = JSON.stringify(updates.imageUrls);
    }
    
    // Handle tags - if it's a string, keep it; if array, stringify it
    if (updates.tags !== undefined) {
      if (Array.isArray(updates.tags)) {
        updates.tags = JSON.stringify(updates.tags);
      } else if (updates.tags === '' || updates.tags === null) {
        updates.tags = null;
      }
    }
    
    // Handle metaFields - merge with existing metaFields if updating
    if (updates.metaFields !== undefined) {
      let mergedMetaFields = {};
      
      // Parse existing metaFields
      if (existingLot.metaFields) {
        try {
          mergedMetaFields = typeof existingLot.metaFields === 'string' 
            ? JSON.parse(existingLot.metaFields) 
            : existingLot.metaFields;
        } catch (e) {
          console.error('Error parsing existing metaFields:', e);
          mergedMetaFields = {};
        }
      }
      
      // Parse new metaFields and merge
      if (typeof updates.metaFields === 'string') {
        try {
          const newMetaFields = JSON.parse(updates.metaFields);
          mergedMetaFields = { ...mergedMetaFields, ...newMetaFields };
        } catch (e) {
          console.error('Invalid metaFields JSON:', e);
          // If invalid, keep existing metaFields
        }
      } else if (typeof updates.metaFields === 'object' && updates.metaFields !== null) {
        mergedMetaFields = { ...mergedMetaFields, ...updates.metaFields };
      } else if (updates.metaFields === '' || updates.metaFields === null) {
        mergedMetaFields = null;
      }
      
      // Convert merged metaFields back to JSON string
      if (mergedMetaFields && Object.keys(mergedMetaFields).length > 0) {
        updates.metaFields = JSON.stringify(mergedMetaFields);
      } else {
        updates.metaFields = null;
      }
    }
    
    // Handle empty strings for optional fields
    if (updates.hebrewTitle === '') {
      updates.hebrewTitle = null;
    }
    if (updates.hebrewDescription === '') {
      updates.hebrewDescription = null;
    }
    
    // Transform status to uppercase
    if (updates.status) {
      updates.status = updates.status.toUpperCase();
    }
    
    // Handle endTime - convert empty string to null
    if (updates.endTime === '' || updates.endTime === null) {
      updates.endTime = null;
    } else if (updates.endTime) {
      // Ensure it's a valid date string
      updates.endTime = new Date(updates.endTime).toISOString();
    }
    
    const lot = await db.lots.update(params.id, updates);
    if (!lot) {
      throw error(404, 'Lot not found');
    }
    return json(lot);
  } catch (err) {
    console.error('Error updating lot:', err);
    if (err.status) {
      throw err;
    }
    throw error(500, 'Failed to update lot');
  }
}

export async function DELETE({ params }) {
  try {
    const lot = await db.lots.getById(params.id);
    if (!lot) {
      throw error(404, 'Lot not found');
    }
    
    // Get all images for this lot before deleting
    const images = await prisma.lotImage.findMany({
      where: { lotId: params.id }
    });
    
    // Delete image files from cloud storage
    for (const image of images) {
      if (image.cloudKey) {
        try {
          await deleteFile(image.cloudKey, 'lots');
        } catch (deleteError) {
          console.warn(`Failed to delete image file ${image.cloudKey} from cloud storage:`, deleteError);
          // Continue with deletion even if file deletion fails
        }
      }
    }
    
    // Delete the lot (this will cascade delete all LotImage records from database)
    await prisma.lot.delete({
      where: { id: params.id }
    });
    
    return json({ message: 'Lot deleted successfully' });
  } catch (err) {
    console.error('Error deleting lot:', err);
    if (err.status) {
      throw err;
    }
    throw error(500, 'Failed to delete lot');
  }
}

