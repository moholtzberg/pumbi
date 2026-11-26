import { error } from '@sveltejs/kit';
import { parseAuctionSettings } from '$lib/server/liveAuctionFloor.js';

export function bidAmount(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') throw error(400, 'Enter a valid bid amount');
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100)) || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) throw error(400, 'Bid amount must be positive with at most two decimal places');
  return Math.round(amount * 100) / 100;
}

export { minimumLotBid } from '$lib/utils/bidIncrements.js';

export function requireOpenLot(lot, now = new Date()) {
  const auction = lot.auction;
  const onBlock = parseAuctionSettings(auction.settings).onBlockLotId;
  if (auction.status !== 'LIVE' || !auction.auctioneerStartedAt || lot.status !== 'ACTIVE' || !lot.isReady || !lot.endTime || new Date(lot.endTime) <= now || (onBlock && onBlock !== lot.id)) throw error(409, 'This lot is not currently open for bidding');
}

export function requirePhoneBuyer(buyer, lot, auctioneerId) {
  if ([auctioneerId, lot.auction.sellerId, lot.ownerUserId].filter(Boolean).includes(buyer.id)) throw error(403, 'The auctioneer, seller, and lot owner cannot be the phone bidder');
}

export function phoneCaller(input) {
  const name = String(input?.name || '').trim();
  const email = String(input?.email || '').trim().toLowerCase();
  const phone = String(input?.phone || '').trim();
  if (!name || name.length > 120) throw error(400, 'Enter the caller’s name (up to 120 characters)');
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw error(400, 'Enter a valid email address for the caller’s invoice');
  if (phone.length > 40 || phone.replace(/\D/g, '').length < 7) throw error(400, 'Enter a valid phone number');
  return { name, email, phone };
}

export function phoneAuctionTerms(auction) {
  return auction.type === 'PUBLIC' ? auction.buyerTermsSnapshot || ''
    : auction.privateHouseBuyerTermsSnapshot || parseAuctionSettings(auction.auctionHouse?.settings).termsOfSaleInEnglish || '';
}
