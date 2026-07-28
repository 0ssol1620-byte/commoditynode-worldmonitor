// @ts-expect-error -- shared JavaScript CORS utility has no declaration file.
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { isCommodityNodeProductGatewayConfigured } from '../server/commoditynode/product-gateway.js';

export const config = { runtime: 'edge' };

const HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function hasRedis(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL
    && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

export default function handler(request: Request): Response {
  if (isDisallowedOrigin(request)) {
    return Response.json(
      { error: 'origin_not_allowed' },
      { status: 403, headers: { ...HEADERS, ...getCorsHeaders(request) } },
    );
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }
  if (request.method !== 'GET') {
    return Response.json(
      { error: 'method_not_allowed' },
      { status: 405, headers: { ...HEADERS, ...getCorsHeaders(request) } },
    );
  }

  const gateway = isCommodityNodeProductGatewayConfigured();
  const rateLimit = hasRedis();
  return Response.json({
    version: 1,
    newsletter: {
      available: Boolean(
        gateway
        && rateLimit
        && process.env.RESEND_API_KEY
        && process.env.COMMODITYNODE_RESEND_FROM,
      ),
    },
    briefRequest: {
      available: Boolean(
        gateway
        && rateLimit
        && process.env.RESEND_API_KEY
        && process.env.COMMODITYNODE_RESEND_FROM
        && process.env.COMMODITYNODE_LEADS_TO,
      ),
    },
    accountFeatures: {
      available: Boolean(
        process.env.VITE_CONVEX_URL
        && process.env.VITE_CLERK_PUBLISHABLE_KEY,
      ),
    },
  }, {
    status: 200,
    headers: { ...HEADERS, ...getCorsHeaders(request) },
  });
}
