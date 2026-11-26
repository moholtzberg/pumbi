import { z } from 'zod';
import { BaseModel } from './BaseModel.js';
import prisma from '$lib/prisma.js';
import { normalizeHouseSlug, houseSlugProblem } from '$lib/utils/houseSlugs.js';

const auctionHouseSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  slug: z.string().transform(normalizeHouseSlug).refine(value => !houseSlugProblem(value), 'Choose a valid, non-reserved public slug (3–50 lowercase letters, numbers, and hyphens)'),
  domain: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional().or(z.literal('')),
  settings: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export class AuctionHouse extends BaseModel {
  static prismaModel = prisma.auctionHouse;
  static schema = auctionHouseSchema;

  static getSearchableFields() {
    return ['name', 'slug', 'description'];
  }

  static getToManyRelations() {
    return ['users', 'auctions'];
  }

  static getDefaultIncludes() {
    return {
      users: true,
      auctions: {
        include: {
          lots: true
        }
      }
    };
  }

  // Override beforeCreate to skip number generation (AuctionHouse doesn't have a number field)
  async beforeCreate() {
    // Skip number generation - AuctionHouse uses slug as identifier
  }
}

