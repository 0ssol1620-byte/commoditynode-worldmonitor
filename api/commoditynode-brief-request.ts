import { ConvexHttpClient } from 'convex/browser';

// @ts-expect-error -- shared JavaScript CORS utility has no declaration file.
import { isDisallowedOrigin } from './_cors.js';
import { checkEndpointRateLimit } from '../server/_shared/rate-limit.js';
import {
  COMMODITYNODE_LEAD_CONSENT_VERSION,
  approvedCommodityIds,
  cleanCommodityNodeLeadField,
  normalizeCommodityNodeEmail,
} from '../server/commoditynode/lead-contract.js';

const PATH = '/api/commoditynode-brief-request';

function headers(request: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': request.headers.get('origin') || 'https://commoditynode.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

function json(request: Request, value: unknown, status: number): Response {
  return Response.json(value, { status, headers: headers(request) });
}

async function notifyOperations(input: {
  name: string;
  email: string;
  organization: string;
  role: string;
  commodityIds: string[];
  decision: string;
  timeframe: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.COMMODITYNODE_RESEND_FROM;
  const to = process.env.COMMODITYNODE_LEADS_TO;
  if (!apiKey || !from || !to) return false;
  const lines = [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Organization: ${input.organization}`,
    `Role: ${input.role || 'Not provided'}`,
    `Commodities: ${input.commodityIds.join(', ')}`,
    `Decision: ${input.decision}`,
    `Timeframe: ${input.timeframe}`,
  ];
  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        replyTo: input.email,
        subject: `CommodityNode exposure brief request — ${input.organization}`,
        text: lines.join('\n'),
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
  if (body.length > 8_192) return json(request, { error: 'payload_too_large' }, 413);
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return json(request, { error: 'invalid_json' }, 400);
  }
  if (cleanCommodityNodeLeadField(raw.website, 100)) {
    return json(request, { status: 'received' }, 202);
  }
  const input = {
    name: cleanCommodityNodeLeadField(raw.name, 120),
    email: normalizeCommodityNodeEmail(raw.email),
    organization: cleanCommodityNodeLeadField(raw.organization, 160),
    role: cleanCommodityNodeLeadField(raw.role, 120),
    commodityIds: approvedCommodityIds(raw.commodityIds),
    decision: cleanCommodityNodeLeadField(raw.decision, 1_200),
    timeframe: cleanCommodityNodeLeadField(raw.timeframe, 120),
  };
  if (
    !input.name
    || !input.email
    || !input.organization
    || input.commodityIds.length === 0
    || input.decision.length < 40
    || !input.timeframe
    || raw.consent !== true
    || raw.consentVersion !== COMMODITYNODE_LEAD_CONSENT_VERSION
  ) return json(request, { error: 'invalid_brief_request' }, 400);

  const convexUrl = process.env.CONVEX_URL;
  if (
    !convexUrl
    || !process.env.RESEND_API_KEY
    || !process.env.COMMODITYNODE_RESEND_FROM
    || !process.env.COMMODITYNODE_LEADS_TO
  ) return json(request, { error: 'brief_request_unavailable' }, 503);

  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.mutation('commodityNodeProduct:submitBriefRequest' as never, {
      ...input,
      email: input.email,
      consentVersion: COMMODITYNODE_LEAD_CONSENT_VERSION,
      consentedAt: Date.now(),
      source: cleanCommodityNodeLeadField(raw.source, 64) || 'research',
    } as never) as { status: 'received'; requestId: string };
    const notified = await notifyOperations({ ...input, email: input.email });
    if (!notified) {
      console.warn('[commoditynode-brief] operations notification delayed', result.requestId);
    }
    return json(request, {
      status: result.status,
      requestId: result.requestId,
      notification: notified ? 'sent' : 'delayed',
    }, 202);
  } catch {
    return json(request, { error: 'brief_request_unavailable' }, 503);
  }
}
