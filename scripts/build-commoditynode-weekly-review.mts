import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  buildCommodityNodeHealthSnapshot,
  type CommodityNodeProviderObservation,
} from '../shared/commoditynode-data-health';
import { COMMODITYNODE_DATA_SOURCES } from '../shared/commoditynode-data-source-registry';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

type ReviewState = 'pass' | 'attention' | 'observed' | 'unobserved';

export interface CommodityNodeWeeklyReviewInput {
  healthObservations?: CommodityNodeProviderObservation[];
  corrections?: Array<{
    id: string;
    severity: 'minor' | 'material' | 'critical';
    status: 'open' | 'resolved' | 'not_substantiated';
    openedAt: string;
    resolvedAt?: string | null;
  }>;
  coreWebVitals?: Array<{
    route: string;
    collectedAt: string;
    sampleSize: number;
    lcpMs: number;
    inpMs: number;
    cls: number;
  }>;
  contentPerformance?: Array<{
    route: string;
    collectedAt: string;
    views: number;
    engagedSessions: number;
    newsletterConversions: number;
    proConversions: number;
  }>;
}

export interface CommodityNodeWeeklyReview {
  schemaVersion: 1;
  generatedAt: string;
  reportingWeek: string;
  overallState: 'ready' | 'attention' | 'incomplete';
  dimensions: {
    dataFreshness: {
      state: ReviewState;
      counts: ReturnType<typeof buildCommodityNodeHealthSnapshot>['counts'];
      note: string;
    };
    corrections: {
      state: ReviewState;
      supplied: boolean;
      open: number;
      resolved: number;
      criticalOpen: number;
      note: string;
    };
    sourceRights: {
      state: ReviewState;
      approved: number;
      reviewRequired: number;
      expired: number;
      note: string;
    };
    coreWebVitals: {
      state: ReviewState;
      supplied: boolean;
      routes: number;
      passingRoutes: number;
      failingRoutes: string[];
      note: string;
    };
    contentPerformance: {
      state: ReviewState;
      supplied: boolean;
      routes: number;
      totals: {
        views: number | null;
        engagedSessions: number | null;
        newsletterConversions: number | null;
        proConversions: number | null;
      };
      note: string;
    };
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[commoditynode-weekly-review] ${message}`);
}

function assertIsoUtc(value: string, field: string): void {
  assert(
    ISO_UTC.test(value) && Number.isFinite(Date.parse(value)),
    `${field} must be an ISO UTC timestamp`,
  );
}

function assertNonNegative(value: number, field: string): void {
  assert(Number.isFinite(value) && value >= 0, `${field} must be non-negative`);
}

function validateInput(input: CommodityNodeWeeklyReviewInput): void {
  for (const correction of input.corrections ?? []) {
    assert(/^[a-z0-9][a-z0-9._-]{2,79}$/i.test(correction.id), 'correction id is invalid');
    assertIsoUtc(correction.openedAt, `${correction.id}.openedAt`);
    if (correction.resolvedAt) {
      assertIsoUtc(correction.resolvedAt, `${correction.id}.resolvedAt`);
      assert(
        Date.parse(correction.resolvedAt) >= Date.parse(correction.openedAt),
        `${correction.id}.resolvedAt precedes openedAt`,
      );
    }
  }
  for (const metric of input.coreWebVitals ?? []) {
    assert(metric.route.startsWith('/') && metric.route.length <= 160, 'CWV route is invalid');
    assertIsoUtc(metric.collectedAt, `${metric.route}.collectedAt`);
    assertNonNegative(metric.sampleSize, `${metric.route}.sampleSize`);
    assertNonNegative(metric.lcpMs, `${metric.route}.lcpMs`);
    assertNonNegative(metric.inpMs, `${metric.route}.inpMs`);
    assertNonNegative(metric.cls, `${metric.route}.cls`);
  }
  for (const metric of input.contentPerformance ?? []) {
    assert(metric.route.startsWith('/') && metric.route.length <= 160, 'content route is invalid');
    assertIsoUtc(metric.collectedAt, `${metric.route}.collectedAt`);
    for (const field of [
      'views',
      'engagedSessions',
      'newsletterConversions',
      'proConversions',
    ] as const) {
      assertNonNegative(metric[field], `${metric.route}.${field}`);
    }
  }
}

function reportingWeek(timestamp: string): string {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

function reviewCorrections(
  corrections: CommodityNodeWeeklyReviewInput['corrections'],
): CommodityNodeWeeklyReview['dimensions']['corrections'] {
  if (!corrections) {
    return {
      state: 'unobserved',
      supplied: false,
      open: 0,
      resolved: 0,
      criticalOpen: 0,
      note: 'No correction ledger was supplied; no zero-correction claim is made.',
    };
  }
  const open = corrections.filter((item) => item.status === 'open');
  const resolved = corrections.filter((item) => item.status === 'resolved');
  const criticalOpen = open.filter((item) => item.severity === 'critical');
  return {
    state: open.length > 0 ? 'attention' : 'pass',
    supplied: true,
    open: open.length,
    resolved: resolved.length,
    criticalOpen: criticalOpen.length,
    note:
      open.length > 0
        ? `${open.length} correction item(s) remain open.`
        : 'The supplied ledger has no open correction items.',
  };
}

function reviewRights(now: string): CommodityNodeWeeklyReview['dimensions']['sourceRights'] {
  let approved = 0;
  let reviewRequired = 0;
  let expired = 0;
  for (const source of COMMODITYNODE_DATA_SOURCES) {
    if (source.rights.status === 'approved') approved += 1;
    else reviewRequired += 1;
    if (
      source.rights.expiresAt
      && Date.parse(source.rights.expiresAt) <= Date.parse(now)
    ) {
      expired += 1;
    }
  }
  return {
    state: reviewRequired > 0 || expired > 0 ? 'attention' : 'pass',
    approved,
    reviewRequired,
    expired,
    note:
      reviewRequired > 0 || expired > 0
        ? 'At least one source remains held from public display or needs renewed review.'
        : 'Every registered source has a current approved rights record.',
  };
}

function reviewCoreWebVitals(
  metrics: CommodityNodeWeeklyReviewInput['coreWebVitals'],
): CommodityNodeWeeklyReview['dimensions']['coreWebVitals'] {
  if (!metrics) {
    return {
      state: 'unobserved',
      supplied: false,
      routes: 0,
      passingRoutes: 0,
      failingRoutes: [],
      note: 'No field CWV export was supplied; lab bundle budgets are reviewed separately.',
    };
  }
  const failingRoutes = metrics
    .filter((metric) => metric.lcpMs > 2_500 || metric.inpMs > 200 || metric.cls > 0.1)
    .map((metric) => metric.route);
  return {
    state: failingRoutes.length > 0 ? 'attention' : 'pass',
    supplied: true,
    routes: metrics.length,
    passingRoutes: metrics.length - failingRoutes.length,
    failingRoutes,
    note:
      failingRoutes.length > 0
        ? 'One or more routes exceed the good LCP, INP, or CLS threshold.'
        : 'Every supplied route is within the good LCP, INP, and CLS thresholds.',
  };
}

function reviewContentPerformance(
  metrics: CommodityNodeWeeklyReviewInput['contentPerformance'],
): CommodityNodeWeeklyReview['dimensions']['contentPerformance'] {
  if (!metrics) {
    return {
      state: 'unobserved',
      supplied: false,
      routes: 0,
      totals: {
        views: null,
        engagedSessions: null,
        newsletterConversions: null,
        proConversions: null,
      },
      note: 'No privacy-reviewed analytics export was supplied; no traffic claim is made.',
    };
  }
  return {
    state: 'observed',
    supplied: true,
    routes: metrics.length,
    totals: {
      views: metrics.reduce((total, item) => total + item.views, 0),
      engagedSessions: metrics.reduce((total, item) => total + item.engagedSessions, 0),
      newsletterConversions: metrics.reduce(
        (total, item) => total + item.newsletterConversions,
        0,
      ),
      proConversions: metrics.reduce((total, item) => total + item.proConversions, 0),
    },
    note: 'Observed totals are reported without an invented target or causal interpretation.',
  };
}

export function buildCommodityNodeWeeklyReview(input: {
  now: string;
  data?: CommodityNodeWeeklyReviewInput;
}): CommodityNodeWeeklyReview {
  assertIsoUtc(input.now, 'now');
  const data = input.data ?? {};
  validateInput(data);
  const health = buildCommodityNodeHealthSnapshot({
    sources: COMMODITYNODE_DATA_SOURCES,
    observations: data.healthObservations ?? [],
    now: input.now,
  });
  const dimensions: CommodityNodeWeeklyReview['dimensions'] = {
    dataFreshness: {
      state:
        health.state === 'operational'
          ? 'pass'
          : health.state === 'unobserved'
            ? 'unobserved'
            : 'attention',
      counts: health.counts,
      note:
        health.state === 'unobserved'
          ? 'No provider observations were supplied; no current-status claim is made.'
          : `Provider health snapshot state: ${health.state}.`,
    },
    corrections: reviewCorrections(data.corrections),
    sourceRights: reviewRights(input.now),
    coreWebVitals: reviewCoreWebVitals(data.coreWebVitals),
    contentPerformance: reviewContentPerformance(data.contentPerformance),
  };
  const states = Object.values(dimensions).map((dimension) => dimension.state);
  const overallState = states.includes('attention')
    ? 'attention'
    : states.includes('unobserved')
      ? 'incomplete'
      : 'ready';
  return {
    schemaVersion: 1,
    generatedAt: input.now,
    reportingWeek: reportingWeek(input.now),
    overallState,
    dimensions,
  };
}

function renderMarkdown(review: CommodityNodeWeeklyReview): string {
  const d = review.dimensions;
  return `# CommodityNode weekly quality review

- Week of: ${review.reportingWeek}
- Generated: ${review.generatedAt}
- Overall state: ${review.overallState}

## Data freshness

State: ${d.dataFreshness.state}. Current ${d.dataFreshness.counts.current}; delayed ${d.dataFreshness.counts.delayed}; unavailable ${d.dataFreshness.counts.unavailable}; unobserved ${d.dataFreshness.counts.unobserved}.

${d.dataFreshness.note}

## Corrections

State: ${d.corrections.state}. Open ${d.corrections.open}; resolved ${d.corrections.resolved}; critical open ${d.corrections.criticalOpen}.

${d.corrections.note}

## Source rights

State: ${d.sourceRights.state}. Approved ${d.sourceRights.approved}; review required ${d.sourceRights.reviewRequired}; expired ${d.sourceRights.expired}.

${d.sourceRights.note}

## Core Web Vitals

State: ${d.coreWebVitals.state}. Passing routes ${d.coreWebVitals.passingRoutes} of ${d.coreWebVitals.routes}. Failing routes: ${d.coreWebVitals.failingRoutes.join(', ') || 'none supplied'}.

${d.coreWebVitals.note}

## Content performance

State: ${d.contentPerformance.state}. Routes ${d.contentPerformance.routes}; views ${d.contentPerformance.totals.views ?? 'unobserved'}; engaged sessions ${d.contentPerformance.totals.engagedSessions ?? 'unobserved'}; newsletter conversions ${d.contentPerformance.totals.newsletterConversions ?? 'unobserved'}; Pro conversions ${d.contentPerformance.totals.proConversions ?? 'unobserved'}.

${d.contentPerformance.note}
`;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export async function writeCommodityNodeWeeklyReview(options: {
  now?: string;
  inputPath?: string;
  outputDirectory?: string;
} = {}): Promise<{ review: CommodityNodeWeeklyReview; outputDirectory: string }> {
  const data = options.inputPath
    ? JSON.parse(await readFile(resolve(options.inputPath), 'utf8')) as CommodityNodeWeeklyReviewInput
    : {};
  const review = buildCommodityNodeWeeklyReview({
    now: options.now ?? new Date().toISOString(),
    data,
  });
  const outputDirectory = resolve(
    options.outputDirectory
      ?? resolve(REPO_ROOT, '.commoditynode-private', 'weekly-review'),
  );
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      resolve(outputDirectory, `${review.reportingWeek}.json`),
      `${JSON.stringify(review, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      resolve(outputDirectory, `${review.reportingWeek}.md`),
      renderMarkdown(review),
      'utf8',
    ),
  ]);
  return { review, outputDirectory };
}

const isDirectRun =
  process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  const result = await writeCommodityNodeWeeklyReview({
    inputPath: argument('--input'),
    outputDirectory: argument('--output'),
    now: argument('--now'),
  });
  console.log(
    `CommodityNode weekly review: ${result.outputDirectory} (${result.review.overallState})`,
  );
}
