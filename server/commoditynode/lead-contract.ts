export const COMMODITYNODE_LEAD_CONSENT_VERSION = 1;
export const COMMODITYNODE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const COMMODITYNODE_TOKEN_RE = /^[a-f0-9]{64}$/;

export function cleanCommodityNodeLeadField(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLength)
    : '';
}

export function normalizeCommodityNodeEmail(value: unknown): string | null {
  const email = cleanCommodityNodeLeadField(value, 254).toLowerCase();
  return COMMODITYNODE_EMAIL_RE.test(email) ? email : null;
}

export function approvedCommodityIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((item) => cleanCommodityNodeLeadField(item, 80).toLowerCase())
      .filter((item) => /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(item)),
  )].slice(0, 12);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function randomHex(bytes = 32): string {
  const output = new Uint8Array(bytes);
  crypto.getRandomValues(output);
  return Array.from(output, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

