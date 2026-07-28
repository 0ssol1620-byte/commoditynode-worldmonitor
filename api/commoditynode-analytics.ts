import { Redis } from '@upstash/redis';

// @ts-expect-error -- shared JavaScript CORS utility has no declaration file.
import { isDisallowedOrigin } from './_cors.js';
import {
  commodityNodeAnalyticsAggregateKey,
  parseCommodityNodeAnalyticsPayload,
} from '../shared/commoditynode-analytics.js';
import { checkRateLimit } from '../server/_shared/rate-limit.js';

export const config = { runtime: 'edge' };

const RETENTION_SECONDS = 400 * 24 * 60 * 60;
const BASE_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function headers(request: Request): Record<string, string> {
  return {
    ...BASE_HEADERS,
    'Access-Control-Allow-Origin': request.headers.get('origin') || 'https://commoditynode.com',
    Vary: 'Origin',
  };
}

function response(request: Request, value: unknown, status: number): Response {
  return Response.json(value, { status, headers: headers(request) });
}

function redisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(request: Request): Promise<Response> {
  if (isDisallowedOrigin(request)) return response(request, { error: 'origin_not_allowed' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(request) });
  if (request.method !== 'POST') return response(request, { error: 'method_not_allowed' }, 405);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return response(request, { error: 'unsupported_media_type' }, 415);
  }

  const rateLimited = await checkRateLimit(request, headers(request));
  if (rateLimited) return rateLimited;

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 2_048) return response(request, { error: 'payload_too_large' }, 413);

  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 2_048) return response(request, { error: 'payload_too_large' }, 413);
    input = JSON.parse(body);
  } catch {
    return response(request, { error: 'invalid_json' }, 400);
  }
  const payload = parseCommodityNodeAnalyticsPayload(input);
  if (!payload) return response(request, { error: 'invalid_event' }, 400);

  const redis = redisClient();
  if (!redis) return response(request, { error: 'analytics_storage_unavailable' }, 503);

  const day = new Date().toISOString().slice(0, 10);
  const key = commodityNodeAnalyticsAggregateKey(payload, day);
  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, RETENTION_SECONDS);
    await pipeline.exec();
    return response(request, { accepted: true }, 202);
  } catch {
    return response(request, { error: 'analytics_storage_unavailable' }, 503);
  }
}
