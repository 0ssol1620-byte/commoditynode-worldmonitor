import { ConvexHttpClient } from 'convex/browser';

import {
  COMMODITYNODE_TOKEN_RE,
  sha256Hex,
} from '../server/commoditynode/lead-contract.js';

export const config = { runtime: 'edge' };

function html(title: string, message: string, status: number): Response {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="robots" content="noindex, nofollow"><title>${title}</title>
<style>html{color-scheme:dark;background:#080b10;color:#e9edf2;font:16px/1.6 system-ui,sans-serif}body{margin:0}main{max-width:38rem;margin:10vh auto;padding:2rem;border-top:2px solid #29b7c9;background:#10151d}h1{font-size:1.75rem}a{color:#5bd4e1}</style></head>
<body><main><p>CommodityNode</p><h1>${title}</h1><p>${message}</p><p><a href="https://commoditynode.com/">Return to CommodityNode Research</a></p></main></body></html>`, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return html('Method not allowed', 'Use the unsubscribe link from your email.', 405);
  }
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!COMMODITYNODE_TOKEN_RE.test(token)) {
    return html('Invalid unsubscribe link', 'This unsubscribe link is not valid.', 400);
  }
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) return html('Unsubscribe unavailable', 'Please try again later.', 503);
  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.mutation(
      'commodityNodeProduct:unsubscribeNewsletter' as never,
      { confirmationTokenHash: await sha256Hex(token) } as never,
    ) as { status: 'unsubscribed' | 'not_found' };
    if (result.status === 'not_found') {
      return html('Already unsubscribed', 'No active subscription was found for this link.', 200);
    }
    return html('Unsubscribed', 'This address will no longer receive the Weekly Commodity Impact Brief.', 200);
  } catch {
    return html('Unsubscribe unavailable', 'Please try again later.', 503);
  }
}
