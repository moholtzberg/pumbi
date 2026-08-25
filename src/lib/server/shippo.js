import { env } from '$env/dynamic/private';

const SHIPPO_API = 'https://api.goshippo.com';

function shippoToken() {
  return env.SHIPPO_API_TOKEN || '';
}

export function isShippoConfigured() {
  return Boolean(shippoToken());
}

async function shippoFetch(path, { method = 'GET', body } = {}) {
  const token = shippoToken();
  if (!token) {
    const error = new Error('SHIPPO_API_TOKEN is not configured');
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${SHIPPO_API}${path}`, {
    method,
    headers: {
      Authorization: `ShippoToken ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.messages?.[0]?.text ||
      payload?.error ||
      `Shippo request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status >= 400 && response.status < 500 ? response.status : 502;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function addressPayload(address, { isResidential = true } = {}) {
  return {
    name: address.name || 'Recipient',
    street1: address.street1,
    street2: address.street2 || '',
    city: address.city,
    state: address.state,
    zip: address.zip,
    country: (address.country || 'US').toUpperCase(),
    phone: address.phone || '',
    email: address.email || '',
    is_residential: isResidential
  };
}

function parcelPayload(parcel = {}) {
  return {
    length: String(parcel.lengthIn || 12),
    width: String(parcel.widthIn || 10),
    height: String(parcel.heightIn || 6),
    distance_unit: 'in',
    weight: String(parcel.weightOz || 16),
    mass_unit: 'oz'
  };
}

function normalizeRate(rate) {
  return {
    objectId: rate.object_id,
    amount: Number(rate.amount),
    currency: String(rate.currency || 'USD').toLowerCase(),
    provider: rate.provider,
    servicelevel: rate.servicelevel?.name || rate.servicelevel_name || rate.servicelevel || 'Standard',
    servicelevelToken: rate.servicelevel?.token || rate.servicelevel_token || null,
    estimatedDays: rate.estimated_days ?? null,
    durationTerms: rate.duration_terms || null
  };
}

/** Dev fallback rates when Shippo is not configured. */
export function mockShippingRates() {
  return [
    {
      objectId: 'mock_usps_priority',
      amount: 12.5,
      currency: 'usd',
      provider: 'USPS',
      servicelevel: 'Priority Mail',
      servicelevelToken: 'usps_priority',
      estimatedDays: 2,
      durationTerms: '1-3 business days',
      mock: true
    },
    {
      objectId: 'mock_usps_ground',
      amount: 7.25,
      currency: 'usd',
      provider: 'USPS',
      servicelevel: 'Ground Advantage',
      servicelevelToken: 'usps_ground_advantage',
      estimatedDays: 5,
      durationTerms: '2-5 business days',
      mock: true
    },
    {
      objectId: 'mock_ups_ground',
      amount: 15.9,
      currency: 'usd',
      provider: 'UPS',
      servicelevel: 'Ground',
      servicelevelToken: 'ups_ground',
      estimatedDays: 4,
      durationTerms: '1-5 business days',
      mock: true
    }
  ];
}

export async function createShippoShipment({ addressFrom, addressTo, parcel }) {
  if (!isShippoConfigured()) {
    return {
      objectId: `mock_shipment_${Date.now()}`,
      rates: mockShippingRates(),
      mock: true
    };
  }

  const shipment = await shippoFetch('/shipments/', {
    method: 'POST',
    body: {
      address_from: addressPayload(addressFrom, { isResidential: false }),
      address_to: addressPayload(addressTo, { isResidential: true }),
      parcels: [parcelPayload(parcel)],
      async: false
    }
  });

  return {
    objectId: shipment.object_id,
    rates: (shipment.rates || []).map(normalizeRate),
    mock: false,
    raw: shipment
  };
}

export async function purchaseShippoLabel(rateId, { metadata = {} } = {}) {
  if (!isShippoConfigured() || String(rateId).startsWith('mock_')) {
    return {
      objectId: `mock_txn_${Date.now()}`,
      status: 'SUCCESS',
      trackingNumber: `MOCK${Date.now().toString().slice(-10)}`,
      trackingUrlProvider: 'https://tools.usps.com/go/TrackConfirmAction',
      labelUrl: null,
      rate: mockShippingRates().find((rate) => rate.objectId === rateId) || mockShippingRates()[0],
      mock: true
    };
  }

  const transaction = await shippoFetch('/transactions/', {
    method: 'POST',
    body: {
      rate: rateId,
      label_file_type: 'PDF',
      async: false,
      metadata: JSON.stringify(metadata)
    }
  });

  if (transaction.status !== 'SUCCESS' && transaction.status !== 'QUEUED') {
    const message =
      transaction.messages?.[0]?.text || `Shippo label purchase failed (${transaction.status})`;
    const error = new Error(message);
    error.status = 502;
    throw error;
  }

  return {
    objectId: transaction.object_id,
    status: transaction.status,
    trackingNumber: transaction.tracking_number,
    trackingUrlProvider: transaction.tracking_url_provider,
    labelUrl: transaction.label_url,
    rate: transaction.rate ? normalizeRate(typeof transaction.rate === 'object' ? transaction.rate : { object_id: transaction.rate, amount: 0 }) : null,
    mock: false,
    raw: transaction
  };
}

export function mapShippoTrackingStatus(status) {
  const code = String(status || '').toUpperCase();
  if (code === 'DELIVERED') return 'DELIVERED';
  if (code === 'TRANSIT') return 'IN_TRANSIT';
  if (code === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY';
  if (code === 'RETURNED' || code === 'RETURN_TO_SENDER') return 'RETURNED';
  if (code === 'FAILURE') return 'FAILURE';
  if (code === 'PRE_TRANSIT' || code === 'UNKNOWN') return 'LABEL_PURCHASED';
  return 'IN_TRANSIT';
}

export function getShippoWebhookToken() {
  return env.SHIPPO_WEBHOOK_TOKEN || '';
}
