import { error, json } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { adminError, requirePlatformAdmin } from '$lib/server/platformAdmin.js';

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw error(400, `${label} is required`);
  return text;
}

function rate(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw error(400, `${label} must be between 0 and 1`);
  }
  return number;
}

export async function GET({ locals }) {
  await requirePlatformAdmin(locals);
  const policies = await prisma.platformPolicy.findMany({
    orderBy: { version: 'desc' },
    include: { createdBy: { select: { name: true, email: true } } }
  });
  return json(policies);
}

export async function POST({ request, locals }) {
  const admin = await requirePlatformAdmin(locals);

  try {
    const data = await request.json();
    let rateConfig = null;
    if (data.rateConfig) {
      try {
        rateConfig = typeof data.rateConfig === 'string' ? JSON.parse(data.rateConfig) : data.rateConfig;
      } catch {
        throw error(400, 'Rate configuration must be valid JSON');
      }
    }

    const policy = await prisma.$transaction(async (tx) => {
      const latest = await tx.platformPolicy.findFirst({
        orderBy: { version: 'desc' },
        select: { version: true }
      });

      return tx.platformPolicy.create({
        data: {
          version: (latest?.version ?? 0) + 1,
          buyerTerms: requiredText(data.buyerTerms, 'Buyer terms'),
          sellerTerms: requiredText(data.sellerTerms, 'Seller terms'),
          buyerPremiumRate: rate(data.buyerPremiumRate, 'Buyer premium rate'),
          sellerCommissionRate: rate(data.sellerCommissionRate, 'Seller commission rate'),
          rateConfig,
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
          createdById: admin.id
        }
      });
    }, { isolationLevel: 'Serializable' });

    return json(policy, { status: 201 });
  } catch (err) {
    adminError(err, 'Failed to create platform policy');
  }
}
