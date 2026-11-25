import { requiresBidderRegistration } from '$lib/utils/biddingAccess.js';
import { escapeEmailHtml as escape } from './smtp2go.js';
import { unsubscribeToken } from './marketingPreferences.js';

export function marketingEmail(row, { live = false } = {}) {
  const { campaign } = row;
  const house = campaign.auctionHouse.name;
  const auction = campaign.auction;
  const link = new URL(row.lotId ? `/lots/${encodeURIComponent(row.lotId)}` : `/auctions/${encodeURIComponent(auction.id)}`, campaign.siteUrl).href;
  const preferences = new URL('/email-preferences', campaign.siteUrl);
  preferences.searchParams.set('token', unsubscribeToken(row.auctionHouseId, row.email));
  const starts = new Date(auction.startDate).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' }) + ' (Eastern time)';
  const registrationRequired = requiresBidderRegistration(auction);
  let subject, body, action;
  switch (row.kind) {
    case 'INVITATION':
      subject = row.subject || `You're invited: ${auction.title}`;
      body = row.message || `${house} invites you to bid in ${auction.title}.\n\nScheduled start: ${starts}. ${registrationRequired ? 'Browse the catalog, create an account or sign in, and register to bid. Bidder approval and the auction terms still apply.' : 'Browse the catalog and sign in to bid. No advance registration or approval is required. Auction terms and buyer premiums apply.'}`;
      action = registrationRequired ? 'Browse auction & register' : 'Browse auction & bid'; break;
    case 'UPDATE':
      subject = row.subject; body = row.message; action = 'View auction'; break;
    case 'AUCTION_START':
      subject = `Starting soon: ${auction.title}`;
      body = `${auction.title} from ${house} is about to begin.\n\nScheduled start: ${starts}. Join the auction and get ready to bid. The auctioneer controls when live bidding opens.`;
      action = 'Join auction'; break;
    case 'LOT_NEXT':
      subject = `${live ? 'Live now' : 'Next up'}: lot #${row.lot.lotNumber} — ${row.lot.title}`;
      body = `A lot you are watching at ${house} is ${live ? 'on the block now' : 'next in the auction queue'}:\n\nLot #${row.lot.lotNumber}: ${row.lot.title}\n${auction.title}\n\nJoin now so you are ready to bid. Queue order and timing can change during the auction.`;
      action = 'View watched lot'; break;
    default: throw new Error('Unknown marketing message kind');
  }
  return {
    to: row.email, subject,
    text: `${house}\n\n${body}\n\n${action}: ${link}\n\nStop auction invitations and reminders from ${house}: ${preferences.href}`,
    html: `<div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#1a2821"><p style="font-size:13px;color:#a95739">PUMBI · ${escape(house)}</p><h1 style="font-size:26px">${escape(subject)}</h1><p style="white-space:pre-wrap;line-height:1.7">${escape(body)}</p><p><a style="display:inline-block;padding:14px 20px;background:#18372f;color:white;text-decoration:none" href="${escape(link)}">${escape(action)}</a></p><hr><p style="font-size:12px">Auction invitations and reminders from ${escape(house)}. <a href="${escape(preferences.href)}">Unsubscribe</a></p></div>`,
    customHeaders: [{ header: 'List-Unsubscribe', value: `<${preferences.href}>` }]
  };
}
