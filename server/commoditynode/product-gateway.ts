const GATEWAY_PATH = '/commoditynode/product';
const GATEWAY_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 16_384;
const MIN_SECRET_LENGTH = 32;

export type CommodityNodeProductOperation =
  | 'cancel_newsletter_confirmation'
  | 'confirm_newsletter_subscription'
  | 'request_newsletter_subscription'
  | 'submit_brief_request'
  | 'unsubscribe_newsletter';

function convexSiteUrl(): string | null {
  const explicit = process.env.CONVEX_SITE_URL?.trim();
  if (explicit) return explicit;
  const deployment = process.env.CONVEX_URL?.trim();
  if (!deployment?.endsWith('.convex.cloud')) return null;
  return deployment.replace(/\.convex\.cloud$/, '.convex.site');
}

function gatewaySecret(): string | null {
  const secret = process.env.COMMODITYNODE_PRODUCT_GATEWAY_SECRET?.trim();
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

export function isCommodityNodeProductGatewayConfigured(): boolean {
  return Boolean(convexSiteUrl() && gatewaySecret());
}

export async function callCommodityNodeProductGateway<T>(
  operation: CommodityNodeProductOperation,
  payload: Record<string, unknown>,
): Promise<T> {
  const siteUrl = convexSiteUrl();
  const secret = gatewaySecret();
  if (!siteUrl || !secret) throw new Error('COMMODITYNODE_PRODUCT_GATEWAY_UNAVAILABLE');

  const response = await fetch(new URL(GATEWAY_PATH, siteUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      'User-Agent': 'CommodityNode-Product-Gateway/1.0',
    },
    body: JSON.stringify({ operation, payload }),
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok || text.length > MAX_RESPONSE_BYTES) {
    throw new Error('COMMODITYNODE_PRODUCT_GATEWAY_REQUEST_FAILED');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('COMMODITYNODE_PRODUCT_GATEWAY_INVALID_RESPONSE');
  }
}
