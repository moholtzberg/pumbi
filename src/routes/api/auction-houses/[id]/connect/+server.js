import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import {
  requireAuthenticatedUser,
  requireAuctionHouseRole
} from '$lib/server/authorization.js';
import {
  getStripe,
  publicConnectStatus,
  syncConnectedAccount
} from '$lib/server/stripe.js';

const BANKING_ROLES = ['OWNER', 'ADMIN', 'FINANCE'];

async function requireHouse(locals, id) {
  const user = await requireAuthenticatedUser(locals);
  await requireAuctionHouseRole(user, id, BANKING_ROLES);
  const house = await prisma.auctionHouse.findUnique({ where: { id } });
  if (!house) throw error(404, 'Auction house not found');
  return house;
}

function accountCreateParams(house) {
  const country = house.country?.trim().toUpperCase();
  if (country && !/^[A-Z]{2}$/.test(country)) {
    throw error(400, 'Auction house country must be a two-letter ISO country code');
  }

  const profile = {
    name: house.legalName || house.name,
    product_description: 'Auction house sales and seller settlements'
  };
  if (house.website && /^https?:\/\//i.test(house.website)) profile.url = house.website;

  return {
    type: 'express',
    ...(country ? { country } : {}),
    ...(house.contactEmail ? { email: house.contactEmail } : {}),
    business_type: 'company',
    business_profile: profile,
    company: { name: house.legalName || house.name },
    capabilities: { transfers: { requested: true } },
    metadata: {
      auctionHouseId: house.id,
      auctionHouseSlug: house.slug
    }
  };
}

async function retrieveAndSync(house) {
  if (!house.stripeConnectAccountId) return house;
  const account = await getStripe().accounts.retrieve(house.stripeConnectAccountId);
  if (account.deleted) throw error(409, 'The connected Stripe account was deleted');
  await syncConnectedAccount(account);
  return prisma.auctionHouse.findUnique({ where: { id: house.id } });
}

export async function GET({ params, locals }) {
  try {
    const house = await retrieveAndSync(await requireHouse(locals, params.id));
    return json(publicConnectStatus(house));
  } catch (err) {
    if (err?.status) throw err;
    console.error('Failed to retrieve Stripe Connect status', err);
    throw error(502, 'Unable to retrieve Stripe Connect status');
  }
}

export async function POST({ params, locals, request }) {
  try {
    let house = await requireHouse(locals, params.id);
    const stripe = getStripe();

    if (!house.stripeConnectAccountId) {
      const account = await stripe.accounts.create(
        accountCreateParams(house),
        { idempotencyKey: `auction-house-connect-${house.id}` }
      );
      await prisma.auctionHouse.update({
        where: { id: house.id },
        data: {
          stripeConnectAccountId: account.id,
          stripeConnectStatus: 'PENDING'
        }
      });
      await syncConnectedAccount(account);
      house = await prisma.auctionHouse.findUnique({ where: { id: house.id } });
    } else {
      house = await retrieveAndSync(house);
    }

    const origin = new URL(request.url).origin;
    const accountLink = await stripe.accountLinks.create({
      account: house.stripeConnectAccountId,
      type: 'account_onboarding',
      refresh_url: `${origin}/seller/banking?stripe=refresh`,
      return_url: `${origin}/seller/banking?stripe=return`
    });

    return json({
      ...publicConnectStatus(house),
      onboardingUrl: accountLink.url,
      expiresAt: accountLink.expires_at
    });
  } catch (err) {
    if (err?.status) throw err;
    console.error('Failed to create Stripe Connect onboarding link', err);
    throw error(502, 'Unable to start Stripe Connect onboarding');
  }
}
