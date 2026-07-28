import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import capabilitiesHandler from '../api/commoditynode-capabilities.ts';
import confirmationHandler from '../api/commoditynode-newsletter-confirm.ts';
import unsubscribeHandler from '../api/commoditynode-newsletter-unsubscribe.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VALID_TOKEN = 'a'.repeat(64);
const CONFIG_KEYS = [
  'COMMODITYNODE_LEADS_TO',
  'COMMODITYNODE_PRODUCT_GATEWAY_SECRET',
  'COMMODITYNODE_RESEND_FROM',
  'CONVEX_SITE_URL',
  'CONVEX_URL',
  'RESEND_API_KEY',
  'UPSTASH_REDIS_REST_TOKEN',
  'UPSTASH_REDIS_REST_URL',
  'VITE_CLERK_PUBLISHABLE_KEY',
  'VITE_CONVEX_URL',
] as const;

async function withMissingProductConfiguration<T>(run: () => Promise<T>): Promise<T> {
  const original = new Map(CONFIG_KEYS.map((key) => [key, process.env[key]]));
  for (const key of CONFIG_KEYS) delete process.env[key];
  try {
    return await run();
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('lead capability endpoint fails closed when production dependencies are absent', async () => {
  await withMissingProductConfiguration(async () => {
    const response = capabilitiesHandler(new Request(
      'https://commoditynode.com/api/commoditynode-capabilities',
    ));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      version: 1,
      newsletter: { available: false },
      briefRequest: { available: false },
      accountFeatures: { available: false },
    });
  });
});

test('email scanners cannot confirm or unsubscribe through a GET request', async () => {
  await withMissingProductConfiguration(async () => {
    const confirm = await confirmationHandler(new Request(
      `https://commoditynode.com/api/commoditynode-newsletter-confirm?token=${VALID_TOKEN}`,
    ));
    const unsubscribe = await unsubscribeHandler(new Request(
      `https://commoditynode.com/api/commoditynode-newsletter-unsubscribe?token=${VALID_TOKEN}`,
    ));
    const confirmHtml = await confirm.text();
    const unsubscribeHtml = await unsubscribe.text();

    assert.equal(confirm.status, 200);
    assert.match(confirmHtml, /method="post"/);
    assert.match(confirmHtml, />Confirm subscription</);
    assert.doesNotMatch(confirmHtml, /Subscription confirmed/);
    assert.equal(unsubscribe.status, 200);
    assert.match(unsubscribeHtml, /method="post"/);
    assert.match(unsubscribeHtml, />Unsubscribe</);
    assert.doesNotMatch(unsubscribeHtml, /This address will no longer receive/);
  });
});

test('lead API routes use only the authenticated product gateway', () => {
  for (const relativePath of [
    'api/commoditynode-brief-request.ts',
    'api/commoditynode-newsletter.ts',
    'api/commoditynode-newsletter-confirm.ts',
    'api/commoditynode-newsletter-unsubscribe.ts',
  ]) {
    const source = readFileSync(`${ROOT}/${relativePath}`, 'utf8');
    assert.doesNotMatch(source, /ConvexHttpClient/);
    assert.match(source, /callCommodityNodeProductGateway/);
  }

  const newsletter = readFileSync(`${ROOT}/api/commoditynode-newsletter.ts`, 'utf8');
  assert.match(newsletter, /status: 'confirmation_requested'/);
  assert.doesNotMatch(newsletter, /return json\(request, \{ status: result\.status \}/);
});

test('lead writes and alert projection remain internal to Convex', () => {
  const product = readFileSync(`${ROOT}/convex/commodityNodeProduct.ts`, 'utf8');
  for (const functionName of [
    'requestNewsletterSubscription',
    'confirmNewsletterSubscription',
    'unsubscribeNewsletter',
    'cancelNewsletterConfirmation',
    'submitBriefRequest',
    'syncCanonicalAlertEvents',
  ]) {
    assert.match(
      product,
      new RegExp(`export const ${functionName} = internalMutation`),
      `${functionName} must not be externally callable through the public Convex API`,
    );
  }

  const vercel = JSON.parse(readFileSync(`${ROOT}/vercel.json`, 'utf8')) as {
    crons?: Array<{ path?: string }>;
  };
  assert.equal(
    vercel.crons?.some((cron) => cron.path === '/api/commoditynode-alert-sync') ?? false,
    false,
  );
  const crons = readFileSync(`${ROOT}/convex/crons.ts`, 'utf8');
  assert.match(crons, /commoditynode-canonical-alert-sync/);
  assert.match(crons, /syncCanonicalAlertEvents/);
});

test('research forms render disabled until capability discovery succeeds', () => {
  const newsletter = readFileSync(
    `${ROOT}/blog-site/src/components/NewsletterSignup.astro`,
    'utf8',
  );
  const brief = readFileSync(`${ROOT}/blog-site/src/pages/brief.astro`, 'utf8');

  assert.match(newsletter, /data-capability-ready="false"/);
  assert.match(newsletter, /required disabled/);
  assert.match(newsletter, /commoditynode-capabilities/);
  assert.match(brief, /data-capability-ready="false"/);
  assert.match(brief, /required disabled/);
  assert.match(brief, /commoditynode-capabilities/);
});
