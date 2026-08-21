import { z } from 'zod';
import { BaseModel } from './BaseModel.js';
import prisma from '$lib/prisma.js';

const auctionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  startDate: z.coerce.date(), // Coerce strings/numbers to Date objects
  endDate: z.coerce.date(), // Coerce strings/numbers to Date objects
  status: z.preprocess(
    value => typeof value === 'string' ? value.toUpperCase() : value,
    z.enum(['UPCOMING', 'LIVE', 'ENDED', 'CANCELLED'])
  ).default('UPCOMING'),
  type: z.preprocess(
    value => typeof value === 'string' ? value.toUpperCase() : value,
    z.enum(['PUBLIC', 'PRIVATE'])
  ).default('PRIVATE'),
  imageUrl: z.string().url().nullable().optional().or(z.literal('')),
  settings: z.string().nullable().optional(),
  auctionHouseId: z.string().min(1, 'Auction house ID is required'),
  sellerId: z.string().min(1, 'Seller ID is required'),
  auctioneerId: z.string().nullable().optional(),
  auctioneerStartedAt: z.coerce.date().nullable().optional(),
  seriesId: z.string().nullable().optional(),
  seriesOccurrenceAt: z.coerce.date().nullable().optional(),
  platformPolicyId: z.string().nullable().optional(),
  policyVersionSnapshot: z.number().int().nullable().optional(),
  buyerTermsSnapshot: z.string().nullable().optional(),
  sellerTermsSnapshot: z.string().nullable().optional(),
  buyerPremiumRateSnapshot: z.coerce.number().nonnegative().nullable().optional(),
  sellerCommissionRateSnapshot: z.coerce.number().nonnegative().nullable().optional(),
  rateConfigSnapshot: z.unknown().nullable().optional(),
  privateHouseNameSnapshot: z.string().nullable().optional(),
  privateHouseBuyerTermsSnapshot: z.string().nullable().optional(),
  privateHouseSellerTermsSnapshot: z.string().nullable().optional(),
  privateHouseBuyerPremiumRateSnapshot: z.coerce.number().nonnegative().nullable().optional(),
  privateHouseSellerCommissionRateSnapshot: z.coerce.number().nonnegative().nullable().optional(),
  privateHouseRateConfigSnapshot: z.unknown().nullable().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export class Auction extends BaseModel {
  static prismaModel = prisma.auction;
  static schema = auctionSchema;

  static getSearchableFields() {
    return ['title', 'description'];
  }

  static getToManyRelations() {
    return ['lots'];
  }

  static getDefaultIncludes() {
    return {
      auctionHouse: true,
      seller: true,
      lots: {
        include: {
          bids: {
            include: {
              user: true
            }
          }
        }
      }
    };
  }

  // Custom validation
  runValidations() {
    if (this.data.startDate && this.data.endDate) {
      const startDate = new Date(this.data.startDate);
      const endDate = new Date(this.data.endDate);
      
      if (endDate <= startDate) {
        this.addError('endDate', 'End date must be after start date');
      }
    }
  }

  // Override beforeCreate to skip number generation (Auction doesn't have a number field)
  async beforeCreate() {
    // Skip number generation - Auction uses title/ID as identifier
  }

  // Override prepareDataForSave to convert date strings to Date objects
  prepareDataForSave(isCreate = false) {
    const data = super.prepareDataForSave(isCreate);
    
    // Convert date strings to Date objects
    if (data.startDate && typeof data.startDate === 'string') {
      data.startDate = new Date(data.startDate);
    }
    if (data.endDate && typeof data.endDate === 'string') {
      data.endDate = new Date(data.endDate);
    }
    
    return data;
  }
}
