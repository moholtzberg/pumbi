import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import prisma from '$lib/prisma.js';
import { connectStatusForAccount, getStripe } from '$lib/server/stripe.js';

export const verificationUserSelect = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  name: true,
  address: true,
  role: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  identityVerificationStatus: true,
  identityVerifiedAt: true,
  stripeIdentitySessionId: true,
  stripeCustomerId: true,
  cardVerificationStatus: true,
  cardVerifiedAt: true,
  paymentMethodBrand: true,
  paymentMethodLast4: true,
  isVerifiedBuyer: true,
  isVerifiedBidder: true,
  sellerProfile: {
    select: {
      id: true,
      businessType: true,
      stripeConnectAccountId: true,
      stripeConnectStatus: true,
      stripeConnectDetailsSubmitted: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectOnboardingDone: true
    }
  },
  auctionHouseMemberships: {
    where: { status: 'ACTIVE' },
    select: {
      role: true,
      auctionHouse: {
        select: {
          id: true,
          name: true,
          onboardingStatus: true,
          stripeConnectStatus: true,
          stripeConnectDetailsSubmitted: true,
          stripeConnectPayoutsEnabled: true
        }
      }
    }
  }
};

export function buyerChecks(user) {
  return {
    email: Boolean(user.emailVerifiedAt),
    phone: Boolean(user.phoneVerifiedAt),
    identity: user.identityVerificationStatus === 'VERIFIED',
    card: user.cardVerificationStatus === 'VERIFIED'
  };
}

export async function refreshBuyerVerification(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: verificationUserSelect });
  if (!user) throw error(404, 'User not found');
  const complete = Object.values(buyerChecks(user)).every(Boolean);
  if (user.isVerifiedBuyer !== complete) {
    return prisma.user.update({
      where: { id: userId },
      data: { isVerifiedBuyer: complete },
      select: verificationUserSelect
    });
  }
  return user;
}

export function publicVerification(user) {
  const checks = buyerChecks(user);
  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      address: user.address,
      role: user.role,
      isVerifiedBuyer: user.isVerifiedBuyer,
      isVerifiedBidder: user.isVerifiedBidder
    },
    checks,
    completedCount: Object.values(checks).filter(Boolean).length,
    identity: {
      status: user.identityVerificationStatus,
      verifiedAt: user.identityVerifiedAt
    },
    card: {
      status: user.cardVerificationStatus,
      verifiedAt: user.cardVerifiedAt,
      brand: user.paymentMethodBrand,
      last4: user.paymentMethodLast4
    },
    seller: user.sellerProfile ? {
      profileId: user.sellerProfile.id,
      businessType: user.sellerProfile.businessType,
      status: user.sellerProfile.stripeConnectStatus,
      detailsSubmitted: user.sellerProfile.stripeConnectDetailsSubmitted,
      payoutsEnabled: user.sellerProfile.stripeConnectPayoutsEnabled,
      complete: user.sellerProfile.stripeConnectOnboardingDone && user.sellerProfile.stripeConnectPayoutsEnabled
    } : null,
    auctionHouses: user.auctionHouseMemberships.map(({ role, auctionHouse }) => ({ role, ...auctionHouse }))
  };
}

function smtp2goConfig() {
  if (!env.SMTP2GO_API_KEY) throw error(503, 'Email and SMS verification is not configured');
  return {
    apiKey: env.SMTP2GO_API_KEY,
    fromEmail: env.SMTP2GO_FROM_EMAIL || 'Pumbi <hello@ginzeyamerica.com>'
  };
}

async function smtp2goRequest(path, body) {
  const config = smtp2goConfig();
  const response = await fetch(`https://api.smtp2go.com/v3/${path}`, {
    method: 'POST',
    headers: {
      'X-Smtp2go-Api-Key': config.apiKey,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.data?.failed > 0 || result.data?.failures?.length) {
    console.error('SMTP2GO delivery failed', {
      status: response.status,
      errorCode: result.data?.error_code,
      failed: result.data?.failed
    });
    throw error(502, result.data?.error || 'Verification message could not be delivered');
  }
  return result;
}

function otpChannel(channel) {
  if (channel === 'email') return 'EMAIL';
  if (channel === 'sms') return 'PHONE';
  throw error(400, 'Channel must be email or sms');
}

function otpSecret() {
  if (!env.AUTH_SECRET) throw error(503, 'Account verification is not configured');
  return env.AUTH_SECRET;
}

function hashDestination(destination) {
  return createHash('sha256').update(destination).digest('hex');
}

function hashCode(userId, channel, code) {
  return createHmac('sha256', otpSecret()).update(`${userId}:${channel}:${code}`).digest('hex');
}

async function deliverVerificationCode(channel, target, code) {
  const config = smtp2goConfig();
  if (channel === 'EMAIL') {
    await smtp2goRequest('email/send', {
      sender: config.fromEmail,
      to: [target],
      subject: 'Your Pumbi verification code',
      text_body: `Your Pumbi verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
      html_body: `<p>Your Pumbi verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
      fastaccept: true
    });
    return;
  }
  await smtp2goRequest('sms/send', {
    destination: [target],
    content: `Your Pumbi verification code is ${code}. It expires in 10 minutes.`
  });
}

export async function startContactVerification(user, channel) {
  if (!prisma.contactVerificationCode) {
    throw error(503, 'Verification storage is not loaded. Regenerate Prisma Client and restart the application.');
  }
  const databaseChannel = otpChannel(channel);
  const target = channel === 'email' ? user.email : normalizePhone(user.phone);
  if (!target) throw error(400, channel === 'email' ? 'Add an email address first' : 'Add a phone number first');
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60_000);
  const oneHourAgo = new Date(now.getTime() - 3_600_000);
  const [latest, sentLastHour] = await Promise.all([
    prisma.contactVerificationCode.findFirst({
      where: { userId: user.id, channel: databaseChannel },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    }),
    prisma.contactVerificationCode.count({
      where: { userId: user.id, channel: databaseChannel, createdAt: { gte: oneHourAgo } }
    })
  ]);
  if (latest?.createdAt > oneMinuteAgo) throw error(429, 'Wait one minute before requesting another code');
  if (sentLastHour >= 5) throw error(429, 'Too many verification codes requested. Try again later');

  const code = String(randomInt(100000, 1_000_000));
  const record = await prisma.$transaction(async (tx) => {
    await tx.contactVerificationCode.updateMany({
      where: { userId: user.id, channel: databaseChannel, consumedAt: null },
      data: { consumedAt: now }
    });
    return tx.contactVerificationCode.create({
      data: {
        userId: user.id,
        channel: databaseChannel,
        destinationHash: hashDestination(target),
        codeHash: hashCode(user.id, databaseChannel, code),
        expiresAt: new Date(now.getTime() + 10 * 60_000)
      }
    });
  });
  try {
    await deliverVerificationCode(databaseChannel, target, code);
  } catch (deliveryError) {
    await prisma.contactVerificationCode.delete({ where: { id: record.id } }).catch(() => {});
    throw deliveryError;
  }
  return { status: 'pending', target: channel === 'email' ? user.email : maskPhone(user.phone) };
}

export async function checkContactVerification(user, channel, code) {
  if (!prisma.contactVerificationCode) {
    throw error(503, 'Verification storage is not loaded. Regenerate Prisma Client and restart the application.');
  }
  const databaseChannel = otpChannel(channel);
  if (!/^\d{6}$/.test(code || '')) throw error(400, 'Enter the six-digit verification code');
  const target = channel === 'email' ? user.email : normalizePhone(user.phone);
  if (!target) throw error(400, 'Verification destination is missing');
  const record = await prisma.contactVerificationCode.findFirst({
    where: {
      userId: user.id,
      channel: databaseChannel,
      consumedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });
  if (!record || record.attempts >= 5 || record.destinationHash !== hashDestination(target)) {
    throw error(400, 'That verification code is invalid or expired');
  }
  const expected = Buffer.from(record.codeHash, 'hex');
  const received = Buffer.from(hashCode(user.id, databaseChannel, code), 'hex');
  const valid = expected.length === received.length && timingSafeEqual(expected, received);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.contactVerificationCode.updateMany({
      where: { id: record.id, consumedAt: null, attempts: record.attempts },
      data: { attempts: { increment: 1 }, ...(valid ? { consumedAt: new Date() } : {}) }
    });
    if (updated.count !== 1) throw error(409, 'Verification code was already used');
    if (valid) {
      await tx.user.update({
        where: { id: user.id },
        data: databaseChannel === 'EMAIL' ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() }
      });
    }
  });
  if (!valid) throw error(400, 'That verification code is invalid or expired');
  return refreshBuyerVerification(user.id);
}

export async function startIdentityVerification(user, origin) {
  const stripe = getStripe();
  let session;
  if (user.stripeIdentitySessionId) {
    session = await stripe.identity.verificationSessions.retrieve(user.stripeIdentitySessionId);
    if (session.status === 'verified') return syncIdentitySession(session);
  } else {
    session = await stripe.identity.verificationSessions.create({
      type: 'document',
      provided_details: { email: user.email },
      options: { document: { require_matching_selfie: true } },
      metadata: { userId: user.id },
      return_url: `${origin}/dashboard/verification?identity=return`
    }, { idempotencyKey: `buyer-identity-${user.id}` });
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeIdentitySessionId: session.id, identityVerificationStatus: 'PENDING' }
    });
  }
  return { url: session.url, status: session.status };
}

export async function syncIdentitySession(session) {
  const userId = session.metadata?.userId;
  const where = userId ? { id: userId } : { stripeIdentitySessionId: session.id };
  const status = session.status === 'verified' ? 'VERIFIED' : session.status === 'requires_input' ? 'REQUIRES_INPUT' : 'PENDING';
  const user = await prisma.user.update({
    where,
    data: {
      stripeIdentitySessionId: session.id,
      identityVerificationStatus: status,
      identityVerifiedAt: status === 'VERIFIED' ? new Date() : null
    }
  });
  return refreshBuyerVerification(user.id);
}

export async function refreshIdentityForUser(user) {
  if (!user.stripeIdentitySessionId) return user;
  return syncIdentitySession(await getStripe().identity.verificationSessions.retrieve(user.stripeIdentitySessionId));
}

export async function startCardVerification(user, origin) {
  const stripe = getStripe();
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || undefined,
      phone: user.phone || undefined,
      metadata: { userId: user.id }
    }, { idempotencyKey: `buyer-customer-${user.id}` });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId, cardVerificationStatus: 'PENDING' } });
  }
  const checkout = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer: customerId,
    payment_method_types: ['card'],
    success_url: `${origin}/dashboard/verification?stripe_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/verification?card=cancelled`,
    metadata: { userId: user.id },
    setup_intent_data: { metadata: { userId: user.id, purpose: 'buyer_verification' } }
  });
  return { url: checkout.url };
}

export async function syncCardCheckoutSession(sessionOrId, expectedUserId = null) {
  const stripe = getStripe();
  const session = typeof sessionOrId === 'string'
    ? await stripe.checkout.sessions.retrieve(sessionOrId, { expand: ['setup_intent.payment_method'] })
    : sessionOrId;
  if (session.mode !== 'setup' || session.status !== 'complete') return null;
  const userId = session.metadata?.userId;
  if (!userId) return null;
  if (expectedUserId && userId !== expectedUserId) throw error(403, 'Card verification session does not belong to this account');
  const setupIntent = typeof session.setup_intent === 'string'
    ? await stripe.setupIntents.retrieve(session.setup_intent, { expand: ['payment_method'] })
    : session.setup_intent;
  const paymentMethod = setupIntent?.payment_method;
  if (!paymentMethod || typeof paymentMethod === 'string' || paymentMethod.type !== 'card') return null;
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      defaultPaymentMethodId: paymentMethod.id,
      paymentMethodBrand: paymentMethod.card?.brand || null,
      paymentMethodLast4: paymentMethod.card?.last4 || null,
      cardVerificationStatus: 'VERIFIED',
      cardVerifiedAt: new Date()
    }
  });
  if (user.stripeCustomerId) {
    await stripe.customers.update(user.stripeCustomerId, { invoice_settings: { default_payment_method: paymentMethod.id } });
  }
  return refreshBuyerVerification(user.id);
}

export async function syncSellerConnectedAccount(account) {
  const data = {
    stripeConnectStatus: connectStatusForAccount(account),
    stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
    stripeConnectChargesEnabled: Boolean(account.charges_enabled),
    stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
    stripeConnectOnboardingDone: Boolean(account.details_submitted)
  };
  const result = await prisma.sellerProfile.updateMany({ where: { stripeConnectAccountId: account.id }, data });
  return { matched: result.count === 1, data };
}

export async function refreshSellerForUser(userId) {
  const profile = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!profile?.stripeConnectAccountId) return profile;
  const account = await getStripe().accounts.retrieve(profile.stripeConnectAccountId);
  if (!account.deleted) await syncSellerConnectedAccount(account);
  return prisma.sellerProfile.findUnique({ where: { userId } });
}

export async function startSellerConnect(user, origin, requestedBusinessType = 'INDIVIDUAL') {
  const businessType = requestedBusinessType === 'BUSINESS' ? 'BUSINESS' : 'INDIVIDUAL';
  const stripe = getStripe();
  let profile = await prisma.sellerProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      displayName: user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      legalName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name,
      contactEmail: user.email,
      contactPhone: user.phone,
      address: user.address
    },
    update: {},
  });
  if (profile.stripeConnectAccountId && profile.businessType !== businessType) {
    throw error(409, 'Seller type cannot be changed after Stripe onboarding has started');
  }
  if (!profile.stripeConnectAccountId && profile.businessType !== businessType) {
    profile = await prisma.sellerProfile.update({ where: { id: profile.id }, data: { businessType } });
  }
  if (!profile.stripeConnectAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      business_type: businessType === 'BUSINESS' ? 'company' : 'individual',
      capabilities: { transfers: { requested: true } },
      business_profile: { product_description: 'Consigned auction lots and seller settlements' },
      metadata: { sellerProfileId: profile.id, userId: user.id, sellerBusinessType: businessType }
    }, { idempotencyKey: `seller-connect-${profile.id}` });
    profile = await prisma.sellerProfile.update({
      where: { id: profile.id },
      data: { stripeConnectAccountId: account.id, stripeConnectStatus: 'PENDING' }
    });
  }
  const account = await stripe.accounts.retrieve(profile.stripeConnectAccountId);
  if (!account.deleted) await syncSellerConnectedAccount(account);
  const link = await stripe.accountLinks.create({
    account: profile.stripeConnectAccountId,
    type: 'account_onboarding',
    refresh_url: `${origin}/dashboard/verification?seller=refresh`,
    return_url: `${origin}/dashboard/verification?seller=return`
  });
  return { url: link.url };
}

export function maskPhone(phone) {
  if (!phone) return '';
  return `${phone.slice(0, Math.max(2, phone.length - 4)).replace(/\d/g, '•')}${phone.slice(-4)}`;
}

function normalizePhone(phone) {
  if (!phone) throw error(400, 'Add a phone number first');
  if (/^\+[1-9]\d{7,14}$/.test(phone)) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  throw error(400, 'Phone number must include a valid country code, for example +12125551234');
}
