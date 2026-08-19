import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { auctionHouseSignupSchema } from '$lib/zod.js';
import prisma from '$lib/prisma.js';

export async function GET({ url }) {
  const slug = url.searchParams.get('slug');
  const id = url.searchParams.get('id');
  
  if (id) {
    const auctionHouse = await db.auctionHouses.getById(id);
    if (!auctionHouse) {
      throw error(404, 'Auction house not found');
    }
    return json(auctionHouse);
  }
  
  if (slug) {
    const auctionHouse = await db.auctionHouses.getBySlug(slug);
    if (!auctionHouse) {
      throw error(404, 'Auction house not found');
    }
    return json(auctionHouse);
  }
  
  const auctionHouses = await db.auctionHouses.getAll();
  return json(auctionHouses);
}

export async function POST({ request, locals }) {
  try {
    const session = await locals.auth?.();
    if (!session?.user?.email) {
      throw error(401, 'Create your account and sign in before registering an auction house.');
    }

    const validated = await auctionHouseSignupSchema.parseAsync(await request.json());
    const result = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUnique({ where: { email: session.user.email } });
      if (!owner) throw error(401, 'Your signed-in account could not be found. Sign out and sign in again.');

      const auctionHouse = await tx.auctionHouse.create({
        data: {
          name: validated.name,
          slug: validated.slug,
          description: validated.description || null,
          domain: validated.domain || null,
          logoUrl: validated.logoUrl || null,
          isActive: false,
          onboardingStatus: 'DRAFT'
        }
      });

      const updatedOwner = await tx.user.update({
        where: { id: owner.id },
        data: {
          auctionHouseId: auctionHouse.id,
          ...(owner.role === 'BUYER' ? { role: 'SELLER' } : {})
        }
      });

      await tx.auctionHouseMembership.create({
        data: {
          auctionHouseId: auctionHouse.id,
          userId: owner.id,
          role: 'OWNER',
          status: 'ACTIVE'
        }
      });

      return { auctionHouse, owner: updatedOwner };
    });

    return json({
      auctionHouse: result.auctionHouse,
      userId: result.owner.id,
      message: 'Auction house created. Continue onboarding to request approval.'
    }, { status: 201 });
  } catch (err) {
    // Handle Zod validation errors
    if (err.name === 'ZodError') {
      const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw error(400, `Validation error: ${messages}`);
    }
    
    // Handle Prisma unique constraint errors
    if (err.code === 'P2002' || err.meta?.target) {
      const target = err.meta?.target?.[0];
      if (target === 'slug') {
        throw error(400, 'An auction house with this slug already exists');
      }
      if (target === 'domain') {
        throw error(400, 'An auction house with this domain already exists');
      }
      if (target === 'email') {
        throw error(400, 'A user with this email already exists');
      }
    }
    
    // Re-throw SvelteKit errors
    if (err.status) {
      throw err;
    }
    
    console.error('Error creating auction house:', err);
    throw error(500, err.message || 'Failed to create auction house');
  }
}
