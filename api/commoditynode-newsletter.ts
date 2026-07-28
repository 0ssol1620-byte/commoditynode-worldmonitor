// @ts-expect-error -- shared JavaScript CORS utility has no declaration file.
import { isDisallowedOrigin } from './_cors.js';
import { checkEndpointRateLimit } from '../server/_shared/rate-limit.js';
import {
  COMMODITYNODE_LEAD_CONSENT_VERSION,
  cleanCommodityNodeLeadField,
  normalizeCommodityNodeEmail,
  randomHex,
  sha256Hex,
} from '../server/commoditynode/lead-contract.js';
import {
  callCommodityNodeProductGateway,
  isCommodityNodeProductGatewayConfigured,
} from '../server/commoditynode/product-gateway.js';

export const config = { runtime: 'edge' };

const PATH = '/api/commoditynode-newsletter';

function headers(request: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': request.headers.get('origin') || 'https://commoditynode.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

function json(request: Request, value: unknown, status: number): Response {
  return Response.json(value, { status, headers: headers(request) });
}

async function sendConfirmation(email: string, token: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.COMMODITYNODE_RESEND_FROM;
  if (!apiKey || !from) return false;
  const confirmUrl = `https://commoditynode.com/api/commoditynode-newsletter-confirm?token=${token}`;
  const unsubscribeUrl = `https://commoditynode.com/api/commoditynode-newsletter-unsubscribe?token=${token}`;
  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Confirm the CommodityNode Weekly Impact Brief',
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        text: [
          'Confirm your subscription to the CommodityNode Weekly Impact Brief.',
          '',
          confirmUrl,
          '',
          'The link expires after 48 hours. If you did not request this, ignore this email.',
          '',
          `Manage or unsubscribe: ${unsubscribeUrl}`,
        ].join('\n'),
      }),
    });
    return result.ok;
  } catch {
    return false;
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (isDisallowedOrigin(request)) return json(request, { error: 'origin_not_allowed' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(request) });
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json(request, { error: 'unsupported_media_type' }, 415);
  }
  const limited = await checkEndpointRateLimit(request, PATH, headers(request));
  if (limited) return limited;

  const body = await request.text();
  if (body.length > 2_048) return json(request, { error: 'payload_too_large' }, 413);
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return json(request, { error: 'invalid_json' }, 400);
  }
  if (cleanCommodityNodeLeadField(input.website, 100)) {
    return json(request, { status: 'confirmation_requested' }, 202);
  }
  const email = normalizeCommodityNodeEmail(input.email);
  if (!email || input.consent !== true || input.consentVersion !== COMMODITYNODE_LEAD_CONSENT_VERSION) {
    return json(request, { error: 'valid_email_and_consent_required' }, 400);
  }

  if (
    !isCommodityNodeProductGatewayConfigured()
    || !process.env.RESEND_API_KEY
    || !process.env.COMMODITYNODE_RESEND_FROM
  ) {
    return json(request, { error: 'newsletter_unavailable' }, 503);
  }
  const token = randomHex();
  const tokenHash = await sha256Hex(token);
  try {
    const result = await callCommodityNodeProductGateway<{
      status: 'already_active' | 'pending' | 'confirmation_required';
    }>('request_newsletter_subscription', {
      email,
      consentVersion: COMMODITYNODE_LEAD_CONSENT_VERSION,
      consentedAt: Date.now(),
      source: cleanCommodityNodeLeadField(input.source, 64) || 'research',
      confirmationTokenHash: tokenHash,
    });

    if (result.status === 'confirmation_required' && !(await sendConfirmation(email, token))) {
      await callCommodityNodeProductGateway('cancel_newsletter_confirmation', {
        confirmationTokenHash: tokenHash,
      }).catch(() => undefined);
      return json(request, { error: 'confirmation_delivery_failed' }, 503);
    }
    return json(request, { status: 'confirmation_requested' }, 202);
  } catch {
    return json(request, { error: 'newsletter_unavailable' }, 503);
  }
}
