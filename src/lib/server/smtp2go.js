import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export function emailConfigured() {
  return Boolean(env.SMTP2GO_API_KEY?.trim());
}

function deliveryError(message, uncertain) {
  // SvelteKit's error() throws; attach delivery certainty before propagating it.
  try { error(502, message); } catch (failure) {
    failure.deliveryUncertain = uncertain;
    throw failure;
  }
}

// Do not retry sends automatically: a timed-out request may already be accepted.
export async function smtp2goRequest(path, body) {
  if (!emailConfigured()) throw error(503, 'SMTP2GO is not configured');
  let response;
  let result;
  try {
    response = await fetch(`https://api.smtp2go.com/v3/${path}`, {
      method: 'POST',
      headers: {
        'X-Smtp2go-Api-Key': env.SMTP2GO_API_KEY.trim(),
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000)
    });
    result = await response.json();
  } catch {
    deliveryError('Message delivery could not be confirmed. Please try again later.', true);
  }
  const data = result?.data;
  const unacceptedEmail = path === 'email/send' && Number(data?.succeeded) !== body.to.length;
  if (!response.ok || !data || data.error || data.error_code || Number(data.failed) > 0 || data.failures?.length || unacceptedEmail) {
    // Provider responses can contain recipients and message bodies. Never log them.
    console.error('SMTP2GO delivery failed', { status: response.status });
    deliveryError('Message could not be delivered. Please try again later.', response.status >= 500 || (!data?.error && !data?.error_code && !Number(data?.failed)));
  }
  return result;
}

export async function sendTransactionalEmail({ to, subject, text, html, customHeaders }) {
  return smtp2goRequest('email/send', {
    sender: env.SMTP2GO_FROM_EMAIL?.trim() || 'Pumbi <hello@ginzeyamerica.com>',
    to: Array.isArray(to) ? to : [to],
    subject,
    text_body: text,
    html_body: html,
    ...(customHeaders ? { custom_headers: customHeaders } : {}),
    // Wait for recipient accounting so immediate sender/recipient rejection is visible.
    fastaccept: false
  });
}

export function escapeEmailHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
