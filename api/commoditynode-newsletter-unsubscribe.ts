import {
  COMMODITYNODE_TOKEN_RE,
  sha256Hex,
} from '../server/commoditynode/lead-contract.js';
import {
  callCommodityNodeProductGateway,
  isCommodityNodeProductGatewayConfigured,
} from '../server/commoditynode/product-gateway.js';

export const config = { runtime: 'edge' };

function html(
  title: string,
  message: string,
  status: number,
  token?: string,
  confirmationRequired = false,
): Response {
  const confirmation = confirmationRequired && token
    ? `<form action="/api/commoditynode-newsletter-unsubscribe?token=${token}" method="post"><button type="submit">Unsubscribe</button></form>`
    : '';
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="robots" content="noindex, nofollow"><title>${title}</title>
<style>html{color-scheme:dark;background:#080b10;color:#e9edf2;font:16px/1.6 system-ui,sans-serif}body{margin:0}main{max-width:38rem;margin:10vh auto;padding:2rem;border-top:2px solid #29b7c9;background:#10151d}h1{font-size:1.75rem}a{color:#5bd4e1}button{border:0;background:#29b7c9;color:#061014;font:700 1rem system-ui,sans-serif;padding:.8rem 1rem;cursor:pointer}button:focus-visible{outline:3px solid #fff;outline-offset:3px}</style></head>
<body><main><p>CommodityNode</p><h1>${title}</h1><p>${message}</p>${confirmation}<p><a href="https://commoditynode.com/">Return to CommodityNode Research</a></p></main></body></html>`, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      Allow: 'GET, POST',
    },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return html('Method not allowed', 'Use the unsubscribe link from your email.', 405);
  }
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!COMMODITYNODE_TOKEN_RE.test(token)) {
    return html('Invalid unsubscribe link', 'This unsubscribe link is not valid.', 400);
  }
  if (request.method === 'GET') {
    return html(
      'Unsubscribe from the weekly brief',
      'Confirm that this address should stop receiving the Weekly Commodity Impact Brief.',
      200,
      token,
      true,
    );
  }
  if (!isCommodityNodeProductGatewayConfigured()) {
    return html('Unsubscribe unavailable', 'Please try again later.', 503);
  }
  try {
    const result = await callCommodityNodeProductGateway<{
      status: 'unsubscribed' | 'not_found';
    }>('unsubscribe_newsletter', {
      confirmationTokenHash: await sha256Hex(token),
    });
    if (result.status === 'not_found') {
      return html('Already unsubscribed', 'No active subscription was found for this link.', 200);
    }
    return html('Unsubscribed', 'This address will no longer receive the Weekly Commodity Impact Brief.', 200);
  } catch {
    return html('Unsubscribe unavailable', 'Please try again later.', 503);
  }
}
