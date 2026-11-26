import { z } from 'zod';
import { BaseModel } from './BaseModel.js';
import prisma from '$lib/prisma.js';
import { minimumLotBid } from '$lib/utils/bidIncrements.js';
import { formatMoney } from '$lib/utils/region.js';

const bidSchema = z.object({
  id: z.string().optional(),
  lotId: z.string().min(1, 'Lot ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  userName: z.string().nullable().optional(),
  amount: z.number().positive('Bid amount must be positive'),
  timestamp: z.date().optional()
});

export class Bid extends BaseModel {
  static prismaModel = prisma.bid;
  static schema = bidSchema;

  static getSearchableFields() {
    return ['userName'];
  }

  static getToManyRelations() {
    return [];
  }

  static getDefaultIncludes() {
    return {
      lot: {
        include: {
          auction: {
            include: {
              auctionHouse: true
            }
          }
        }
      },
      user: true
    };
  }

  // Custom validation
  async runValidations() {
    // Validate bid amount against lot's current bid and increment
    if (this.data.lotId && this.data.amount !== undefined) {
      try {
        const lot = await prisma.lot.findUnique({
          where: { id: this.data.lotId },
          include: { auction: { include: { auctionHouse: true } } }
        });

        if (!lot) {
          this.addError('lotId', 'Lot not found');
          return;
        }

        const minimumBid = minimumLotBid(lot);
        if (this.data.amount < minimumBid) {
          this.addError('amount', `Bid must be at least ${formatMoney(minimumBid, lot.auction?.currency || 'usd')}`);
        }
      } catch (error) {
        // If we can't validate, continue (might be a new lot)
        console.warn('Could not validate bid against lot:', error);
      }
    }
  }

  // Override beforeCreate to update lot's current bid
  async beforeCreate() {
    // Skip number generation - Bid doesn't have a number field
    // Don't call super.beforeCreate() to avoid number generation
    
    // Set timestamp if not provided
    if (!this.data.timestamp) {
      this.data.timestamp = new Date();
    }

    // Update lot's current bid and highest bidder
    if (this.data.lotId && this.data.amount !== undefined) {
      try {
        await prisma.lot.update({
          where: { id: this.data.lotId },
          data: {
            currentBid: this.data.amount,
            highestBidderId: this.data.userId,
            highestBidderName: this.data.userName || null
          }
        });
      } catch (error) {
        console.error('Error updating lot bid:', error);
        // Don't throw - let the transaction handle it
      }
    }
  }
}

