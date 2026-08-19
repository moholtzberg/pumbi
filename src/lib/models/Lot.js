import { z } from 'zod';
import { BaseModel } from './BaseModel.js';
import prisma from '$lib/prisma.js';

const lotSchema = z.object({
  id: z.string().optional(),
  auctionId: z.string().min(1, 'Auction ID is required'),
  lotNumber: z.number().int().positive('Lot number must be positive'),
  position: z.number().int().nonnegative('Position must be non-negative').default(0),
  title: z.string().min(1, 'Title is required'),
  hebrewTitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  hebrewDescription: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.union([
    z.string().nullable(),
    z.array(z.string()).nullable()
  ]).optional(),
  metaFields: z.union([
    z.string().nullable(),
    z.record(z.any()).nullable()
  ]).optional(),
  startingBid: z.number().nonnegative('Starting bid must be non-negative'),
  currentBid: z.number().nonnegative('Current bid must be non-negative').default(0),
  bidIncrement: z.number().positive('Bid increment must be positive'),
  imageUrl: z.string().url().nullable().optional().or(z.literal('')),
  imageUrls: z.array(z.string().url()).nullable().optional(),
  status: z.string()
    .transform(val => val ? val.toUpperCase() : 'ACTIVE')
    .refine(val => ['ACTIVE', 'SOLD', 'UNSOLD', 'WITHDRAWN'].includes(val), {
      message: 'Status must be one of: ACTIVE, SOLD, UNSOLD, WITHDRAWN'
    })
    .default('ACTIVE'),
  endTime: z.preprocess((val) => {
    // Handle all possible input types
    if (val === null || val === undefined || val === '') {
      return null;
    }
    if (typeof val === 'string' && val.trim() === '') {
      return null;
    }
    // If it's already a Date object, return it as-is (Zod will validate it)
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val;
    }
    // If it's a string, try to parse it to a Date
    // Handle datetime-local format (YYYY-MM-DDTHH:mm) by adding seconds if missing
    if (typeof val === 'string') {
      // If the string matches datetime-local format (no seconds), add :00 for seconds
      let dateString = val;
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val)) {
        dateString = val + ':00'; // Add seconds
      }
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    }
    // For any other type (including objects), return null
    return null;
  }, z.union([z.date(), z.null()]).optional()),
  initialTimerSeconds: z.coerce.number().int().positive().nullable().optional(),
  bidExtensionSeconds: z.coerce.number().int().positive().nullable().optional(),
  highestBidderId: z.string().nullable().optional(),
  highestBidderName: z.string().nullable().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export class Lot extends BaseModel {
  static prismaModel = prisma.lot;
  static schema = lotSchema;

  static getSearchableFields() {
    return ['title', 'hebrewTitle', 'description', 'hebrewDescription', 'category'];
  }

  static getToManyRelations() {
    return ['bids'];
  }

  static getDefaultIncludes() {
    return {
      auction: {
        include: {
          auctionHouse: true,
          seller: true
        }
      },
      bids: {
        include: {
          user: true
        },
        orderBy: {
          timestamp: 'desc'
        }
      }
    };
  }

  // Custom validation
  runValidations() {
    if (this.data.currentBid !== undefined && this.data.startingBid !== undefined) {
      if (this.data.currentBid < this.data.startingBid) {
        this.addError('currentBid', 'Current bid cannot be less than starting bid');
      }
    }

    if (this.data.imageUrls && Array.isArray(this.data.imageUrls)) {
      // Convert array to JSON string for storage
      this.data.imageUrls = JSON.stringify(this.data.imageUrls);
    }
  }

  // Override prepareDataForSave to handle imageUrls and tags
  prepareDataForSave(isCreate = false) {
    const data = super.prepareDataForSave(isCreate);
    
    // Convert imageUrls array to JSON string if it's an array
    if (data.imageUrls && Array.isArray(data.imageUrls)) {
      data.imageUrls = JSON.stringify(data.imageUrls);
    }
    
    // Convert tags array to JSON string if it's an array
    if (data.tags !== undefined) {
      if (Array.isArray(data.tags)) {
        data.tags = data.tags.length > 0 ? JSON.stringify(data.tags) : null;
      } else if (typeof data.tags === 'string') {
        // If it's already a JSON string, try to parse and re-stringify to validate
        // Or just keep it as is if it's already valid JSON
        if (data.tags.trim() === '' || data.tags === 'null') {
          data.tags = null;
        }
        // Otherwise keep the string as is (it's already JSON stringified)
      } else if (data.tags === '' || data.tags === null) {
        data.tags = null;
      }
    }
    
    // Convert metaFields object to JSON string if it's an object
    if (data.metaFields !== undefined) {
      if (typeof data.metaFields === 'object' && data.metaFields !== null) {
        data.metaFields = JSON.stringify(data.metaFields);
      } else if (typeof data.metaFields === 'string') {
        // If it's already a JSON string, validate it
        if (data.metaFields.trim() === '' || data.metaFields === 'null') {
          data.metaFields = null;
        }
        // Otherwise keep the string as is
      } else if (data.metaFields === '' || data.metaFields === null) {
        data.metaFields = null;
      }
    }
    
    return data;
  }

  // Override beforeCreate to skip number generation (Lot uses lotNumber, not number)
  async beforeCreate() {
    // Skip number generation - Lot uses lotNumber field
  }

  // Override serializeForJson to parse imageUrls and tags back to array
  serializeForJson() {
    const serialized = super.serializeForJson();
    
    // Parse imageUrls JSON string back to array if it exists
    if (serialized.imageUrls && typeof serialized.imageUrls === 'string') {
      try {
        serialized.imageUrls = JSON.parse(serialized.imageUrls);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }
    
    // Parse tags JSON string back to array if it exists
    if (serialized.tags && typeof serialized.tags === 'string') {
      try {
        serialized.tags = JSON.parse(serialized.tags);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }
    
    // Parse metaFields JSON string back to object if it exists
    if (serialized.metaFields && typeof serialized.metaFields === 'string') {
      try {
        serialized.metaFields = JSON.parse(serialized.metaFields);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }
    
    return serialized;
  }
}
