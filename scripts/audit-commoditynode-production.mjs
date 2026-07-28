import { execFileSync } from 'node:child_process';

const DEFAULT_RESEARCH_ORIGIN = 'https://commoditynode.com';
const DEFAULT_LIVE_URL = 'https://commoditynode.com/live/';
const DEFAULT_FALLBACK_ORIGIN = 'https://commoditynode-live.vercel.app';
const REQUEST_TIMEOUT_MS = 20_000;
const HANGUL_RE = /[\uAC00-\uD7A3]/u;

const failures = [];
const observations = [];

function argValue(name) {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);
}

function normalizedOrigin(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must be a credential-free HTTPS origin`);
  }
  url.pathname = '/';
  return url.origin;
}

function normalizedHttpsUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must be a credential-free HTTPS URL`);
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

function currentCommit() {
  const explicit = argValue('expected-sha') || process.env.COMMODITYNODE_EXPECTED_SHA;
  if (explicit) return explicit.trim().toLowerCase();
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().toLowerCase();
  } catch {
    return '';
  }
}

function fail(label, message) {
  failures.push(`${label}: ${message}`);
}

async function get(origin, path, options = {}) {
  const url = new URL(path, origin);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      cache: 'no-store',
      redirect: options.redirect ?? 'manual',
      headers: {
        'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'user-agent': 'CommodityNodeProductionAudit/1.0',
        ...options.headers,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function inspectEnglishHtml(label, html) {
  const lang = html.match(/<html[^>]*\blang=["']([^"']+)/i)?.[1] ?? '';
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? '';
  if (lang.toLowerCase() !== 'en') fail(label, `expected html lang=en, received ${lang || 'missing'}`);
  if (!title) fail(label, 'title is missing');
  if (HANGUL_RE.test(html)) fail(label, 'unexpected Hangul is present in the English response');
  return { lang, title };
}

async function auditHtml(origin, path, expectedStatus = 200) {
  const label = `${origin}${path}`;
  try {
    const response = await get(origin, path);
    const html = await response.text();
    if (response.status !== expectedStatus) {
      fail(label, `expected HTTP ${expectedStatus}, received ${response.status}`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('text/html')) {
      fail(label, `expected text/html, received ${contentType || 'missing content type'}`);
    }
    const language = inspectEnglishHtml(label, html);
    observations.push({
      url: label,
      status: response.status,
      ...language,
      xRobotsTag: response.headers.get('x-robots-tag'),
    });
    return { response, html };
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function auditBuildRecord(origin, expectedSha) {
  const path = '/.well-known/commoditynode-build.json';
  const label = `${origin}${path}`;
  try {
    const response = await get(origin, path);
    if (response.status !== 200) {
      fail(label, `expected HTTP 200, received ${response.status}`);
      return;
    }
    const record = await response.json();
    const commitSha = String(record?.commitSha ?? '').toLowerCase();
    if (!/^[0-9a-f]{40}$/.test(commitSha)) {
      fail(label, 'commitSha is missing or invalid');
    }
    if (expectedSha && commitSha !== expectedSha) {
      fail(label, `expected commit ${expectedSha}, received ${commitSha || 'missing'}`);
    }
    if (record?.product !== 'CommodityNode' || record?.variant !== 'commoditynode') {
      fail(label, 'product or variant provenance is incorrect');
    }
    observations.push({
      url: label,
      status: response.status,
      commitSha,
      buildDate: record?.buildDate ?? null,
    });
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  }
}

const researchOrigin = normalizedOrigin(
  argValue('research-origin') || process.env.COMMODITYNODE_RESEARCH_ORIGIN || DEFAULT_RESEARCH_ORIGIN,
  'research origin',
);
const liveUrl = normalizedHttpsUrl(
  argValue('live-url') || process.env.COMMODITYNODE_LIVE_URL || DEFAULT_LIVE_URL,
  'live URL',
);
const fallbackOrigin = normalizedOrigin(
  argValue('fallback-origin') || process.env.COMMODITYNODE_FALLBACK_ORIGIN || DEFAULT_FALLBACK_ORIGIN,
  'fallback origin',
);
const expectedSha = currentCommit();

for (const path of [
  '/',
  '/commodities/crude-oil/',
  '/companies/first-quantum-minerals/',
  '/events/cobre-panama-production-halt/',
]) {
  await auditHtml(researchOrigin, path);
}

for (const path of [
  '/companies/fcx/',
  '/commodities/phosphate/',
  '/commodities/lithium/',
  '/commodities/silver/',
  '/commodities/tungsten/',
  '/commodities/chromium/',
  '/tin-electronics-semiconductor/',
  '/natural-gas/',
  '/copper-structural-deficit-infrastructure/',
  '/soybeans-livestock-biofuel/',
]) {
  const result = await auditHtml(researchOrigin, path, 410);
  if (!result) continue;
  const robots = result.response.headers.get('x-robots-tag') ?? '';
  if (!/\bnoindex\b/i.test(robots)) {
    fail(`${researchOrigin}${path}`, '410 response is missing X-Robots-Tag noindex');
  }
  if (/<link[^>]+rel=["']canonical["']/i.test(result.html)) {
    fail(`${researchOrigin}${path}`, '410 response must not claim a canonical successor');
  }
}

try {
  const path = '/api/commoditynode-capabilities';
  const response = await get(researchOrigin, path);
  const body = await response.json();
  if (response.status !== 200) {
    fail(`${researchOrigin}${path}`, `expected HTTP 200, received ${response.status}`);
  }
  if (
    body?.version !== 1
    || typeof body?.newsletter?.available !== 'boolean'
    || typeof body?.briefRequest?.available !== 'boolean'
    || typeof body?.accountFeatures?.available !== 'boolean'
  ) {
    fail(`${researchOrigin}${path}`, 'capability response contract is invalid');
  }
  observations.push({
    url: `${researchOrigin}${path}`,
    status: response.status,
    capabilities: {
      newsletter: body?.newsletter?.available ?? null,
      briefRequest: body?.briefRequest?.available ?? null,
      accountFeatures: body?.accountFeatures?.available ?? null,
    },
  });
} catch (error) {
  fail(
    `${researchOrigin}/api/commoditynode-capabilities`,
    error instanceof Error ? error.message : String(error),
  );
}

const liveLocation = new URL(liveUrl);
await auditHtml(liveLocation.origin, liveLocation.pathname);
if (fallbackOrigin !== liveLocation.origin) await auditHtml(fallbackOrigin, '/');

await auditBuildRecord(researchOrigin, expectedSha);
if (fallbackOrigin !== researchOrigin) await auditBuildRecord(fallbackOrigin, expectedSha);

const report = {
  status: failures.length === 0 ? 'pass' : 'fail',
  auditedAt: new Date().toISOString(),
  expectedSha: expectedSha || null,
  origins: { researchOrigin, liveUrl, fallbackOrigin },
  observations,
  failures,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exitCode = 1;
