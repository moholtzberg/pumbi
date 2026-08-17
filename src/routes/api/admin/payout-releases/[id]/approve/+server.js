import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { requirePlatformAdmin } from '$lib/server/platformAdmin.js';
import {
  amountToMinorUnits,
  assertHousePayoutReady,
  stripeErrorMessage
} from '$lib/server/payouts.js';
import { getStripe } from '$lib/server/stripe.js';

async function claimRelease(id, adminId) {
  return prisma.$transaction(async (tx) => {
    let release = await tx.payoutRelease.findUnique({
      where: { id },
      include: { auctionHouse: true }
    });
    if (!release) throw error(404, 'Payout release not found');
    if (release.status === 'PAID') return { release, alreadyPaid: true };

    if (release.status === 'REQUESTED') {
      assertHousePayoutReady(release.auctionHouse);
      const idempotencyKey = `payout-release-${release.id}`;
      const claimed = await tx.payoutRelease.updateMany({
        where: { id: release.id, status: 'REQUESTED' },
        data: {
          status: 'PROCESSING',
          approvedById: adminId,
          approvedAt: new Date(),
          processedAt: new Date(),
          stripeIdempotencyKey: idempotencyKey,
          stripeError: null
        }
      });
      if (claimed.count !== 1) throw error(409, 'Payout release was already claimed');
      release = await tx.payoutRelease.findUnique({
        where: { id },
        include: { auctionHouse: true }
      });
    } else if (release.status !== 'PROCESSING' || !release.stripeIdempotencyKey) {
      throw error(409, 'Payout release is not awaiting approval');
    }

    assertHousePayoutReady(release.auctionHouse);
    return { release, alreadyPaid: false };
  }, { isolationLevel: 'Serializable' });
}

export async function POST({ params, locals }) {
  const admin = await requirePlatformAdmin(locals);
  const { release, alreadyPaid } = await claimRelease(params.id, admin.id);
  if (alreadyPaid) return json(release);

  let transfer;
  try {
    transfer = await getStripe().transfers.create(
      {
        amount: amountToMinorUnits(release.amount.toString()),
        currency: release.currency,
        destination: release.auctionHouse.stripeConnectAccountId,
        description: release.reason.slice(0, 500),
        transfer_group: release.sourceReference,
        metadata: {
          payoutReleaseId: release.id,
          auctionHouseId: release.auctionHouseId,
          sourceReference: release.sourceReference
        }
      },
      { idempotencyKey: release.stripeIdempotencyKey }
    );
  } catch (err) {
    const stripeError = stripeErrorMessage(err);
    await prisma.payoutRelease.updateMany({
      where: {
        id: release.id,
        status: 'PROCESSING',
        stripeIdempotencyKey: release.stripeIdempotencyKey
      },
      data: {
        status: 'FAILED',
        stripeError,
        processedAt: new Date()
      }
    });
    console.error(`Stripe transfer failed for payout release ${release.id}`, err);
    throw error(502, 'Stripe transfer failed; the release was marked failed');
  }

  try {
    const paid = await prisma.payoutRelease.update({
      where: { id: release.id },
      data: {
        status: 'PAID',
        stripeTransferId: transfer.id,
        paidAt: new Date(),
        processedAt: new Date(),
        stripeError: null
      },
      include: {
        auctionHouse: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } }
      }
    });
    return json(paid);
  } catch (err) {
    console.error(`Stripe transfer ${transfer.id} succeeded but payout release ${release.id} was not finalized`, err);
    throw error(500, 'Transfer succeeded but local finalization failed; retry approval to reconcile safely');
  }
}
