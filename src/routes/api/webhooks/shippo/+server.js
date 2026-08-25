import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getShippoWebhookToken } from '$lib/server/shippo.js';
import { applyShippoTrackingUpdate } from '$lib/server/shipping.js';

/**
 * Shippo tracking webhook.
 * Configure Shippo to POST to /api/webhooks/shippo
 * Optional shared secret: SHIPPO_WEBHOOK_TOKEN (query ?token= or header x-shippo-token)
 */
export async function POST({ request, url }) {
  const configured = getShippoWebhookToken();
  if (configured) {
    const provided =
      request.headers.get('x-shippo-token') ||
      url.searchParams.get('token') ||
      '';
    if (provided !== configured) {
      throw error(401, 'Invalid Shippo webhook token');
    }
  }

  const body = await request.json().catch(() => null);
  if (!body) throw error(400, 'Invalid JSON body');

  // Shippo sends either { data: tracking object, event: '...' } or the tracking object directly.
  const tracking = body.data || body;
  const trackingNumber = tracking.tracking_number || tracking.trackingNumber;
  if (!trackingNumber) {
    return json({ received: true, ignored: true });
  }

  const status =
    tracking.tracking_status?.status ||
    tracking.status ||
    body.event ||
    '';
  const statusDetails =
    tracking.tracking_status?.status_details ||
    tracking.status_details ||
    null;
  const eta = tracking.eta || tracking.tracking_status?.eta || null;
  const trackingUrl =
    tracking.tracking_url_provider ||
    tracking.tracking_url ||
    null;
  const events = tracking.tracking_history || tracking.events || null;

  const updated = await applyShippoTrackingUpdate({
    trackingNumber,
    status,
    statusDetails,
    eta,
    trackingUrl,
    events
  });

  if (!updated && env.NODE_ENV !== 'production') {
    console.info('Shippo webhook for unknown tracking number', trackingNumber);
  }

  return json({ received: true, matched: Boolean(updated) });
}
