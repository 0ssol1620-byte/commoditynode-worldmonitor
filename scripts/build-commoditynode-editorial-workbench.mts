import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  allowedCommodityNodeEditorialActions,
  assessCommodityNodeEditorialCandidate,
  type CommodityNodeEditorialCandidate,
  type CommodityNodeEditorialClaim,
  type CommodityNodeEditorialState,
  type CommodityNodeReviewAction,
} from '../shared/commoditynode-editorial-workflow';
import {
  parseCommodityNodeEventExtraction,
  type CommodityNodeEventDirection,
  type CommodityNodeEventType,
} from '../shared/commoditynode-event-extraction';
import {
  COMMODITYNODE_SOURCE_CATALOG,
  validateCommodityNodeSourceCatalog,
} from '../shared/commoditynode-source-catalog';

type ContentEvent = {
  title: string;
  summary: string;
  occurredAt: string;
  status: 'candidate' | 'reviewed' | 'published' | 'superseded' | 'expired' | 'rejected';
  isFixture: boolean;
  commodityIds: string[];
  eventType: CommodityNodeEventType;
  direction: CommodityNodeEventDirection;
  materiality: 'minor' | 'notable' | 'material' | 'critical';
  location?: CommodityNodeEditorialCandidate['location'];
  entities: Array<{ id: string; name: string; type: string }>;
  claims: Array<{ id: string; text: string; evidenceIds: string[] }>;
  evidence: CommodityNodeEditorialCandidate['evidence'];
  impactPath: Array<{
    order: number;
    nodeId: string;
    label: string;
    nodeType: string;
    mechanism: string;
    confidence: string;
  }>;
  unknowns: string[];
  reviewedBy?: string;
  reviewedAt?: string;
};

export type CommodityNodeEditorialWorkbenchItem = CommodityNodeEditorialCandidate & {
  summary: string;
  entities: Array<{ id: string; name: string; type: string }>;
  impactPath: ContentEvent['impactPath'];
  assessment: ReturnType<typeof assessCommodityNodeEditorialCandidate>;
};

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function publicStatusToEditorialState(
  status: ContentEvent['status'],
): CommodityNodeEditorialCandidate['state'] {
  if (status === 'published') return 'published';
  if (status === 'superseded') return 'superseded';
  if (status === 'rejected' || status === 'expired') return 'retracted';
  if (status === 'reviewed') return 'needs_review';
  return 'machine_extracted';
}

function toWorkbenchItem(id: string, event: ContentEvent): CommodityNodeEditorialWorkbenchItem {
  const extraction = parseCommodityNodeEventExtraction({
    commodityIds: event.commodityIds,
    entityIds: event.entities.map((entity) => entity.id),
    location: event.location,
    eventType: event.eventType,
    direction: event.direction,
    materiality: event.materiality,
  });
  const candidate: CommodityNodeEditorialCandidate = {
    id,
    title: event.title,
    state: publicStatusToEditorialState(event.status),
    isFixture: event.isFixture,
    commodityIds: extraction.commodityIds,
    eventType: extraction.eventType,
    direction: extraction.direction,
    materiality: event.materiality,
    occurredAt: event.occurredAt,
    location: extraction.location,
    entityIds: extraction.entityIds,
    claims: event.claims,
    evidence: event.evidence,
    graphCandidates: event.impactPath.slice(0, -1).map((step, index) => {
      const next = event.impactPath[index + 1]!;
      return {
        id: `${id}.path-${step.order}`,
        sourceEntityId: step.nodeId,
        targetEntityId: next.nodeId,
        relationType: 'impact_path',
        direction: 'conditional' as const,
        condition: step.mechanism,
        invalidation: 'Re-review when linked evidence, event status, or entity resolution changes.',
        evidenceIds: event.evidence.map((item) => item.id),
      };
    }),
    unknowns: event.unknowns,
    rightsIssues: [],
    reviewedBy: event.reviewedBy ?? null,
    reviewedAt: event.reviewedAt ?? null,
  };
  return {
    ...candidate,
    summary: event.summary,
    entities: event.entities,
    impactPath: event.impactPath,
    assessment: assessCommodityNodeEditorialCandidate(candidate),
  };
}

async function loadWorkbenchItems(): Promise<CommodityNodeEditorialWorkbenchItem[]> {
  const eventDirectory = join(REPO_ROOT, 'blog-site', 'src', 'content', 'events');
  const files = (await readdir(eventDirectory))
    .filter((name) => name.endsWith('.json'))
    .sort();
  const items = await Promise.all(
    files.map(async (name) => {
      const event = JSON.parse(await readFile(join(eventDirectory, name), 'utf8')) as ContentEvent;
      return toWorkbenchItem(basename(name, '.json'), event);
    }),
  );
  return items.sort((a, b) => {
    if (a.state === 'published' && b.state !== 'published') return 1;
    if (b.state === 'published' && a.state !== 'published') return -1;
    return b.occurredAt.localeCompare(a.occurredAt);
  });
}

function renderSourceTable(): string {
  return COMMODITYNODE_SOURCE_CATALOG.map((source) => `
    <tr>
      <td><strong>${escapeHtml(source.name)}</strong><span>${escapeHtml(source.publisher)}</span></td>
      <td>${escapeHtml(source.authority.replaceAll('_', ' '))}</td>
      <td>${escapeHtml(source.transport.toUpperCase())}</td>
      <td>${source.collection.enabled ? 'Enabled' : 'Held'}</td>
      <td>${escapeHtml(source.targetCommodityIds.join(', '))}</td>
      <td>${escapeHtml(source.rights.reviewStatus.replace('_', ' '))}</td>
    </tr>`).join('');
}

function renderClaim(claim: CommodityNodeEditorialClaim, item: CommodityNodeEditorialWorkbenchItem): string {
  const evidence = claim.evidenceIds
    .map((id) => item.evidence.find((record) => record.id === id))
    .filter((record): record is NonNullable<typeof record> => Boolean(record));
  return `
    <article class="ledger-item">
      <div class="ledger-id">${escapeHtml(claim.id)}</div>
      <p>${escapeHtml(claim.text)}</p>
      <div class="evidence-links">
        ${evidence.map((record) => `
          <a href="${escapeHtml(record.url)}" target="_blank" rel="noreferrer">
            ${escapeHtml(record.publisher)} · ${escapeHtml(record.locator)}
          </a>`).join('')}
      </div>
    </article>`;
}

function renderEvent(item: CommodityNodeEditorialWorkbenchItem): string {
  const coverage = item.assessment.evidenceCoverage;
  const stateLabel = item.state.replaceAll('_', ' ');
  const actions = allowedCommodityNodeEditorialActions(item.state);
  const labels: Record<CommodityNodeReviewAction, string> = {
    request_sources: 'Request sources',
    request_rights: 'Request rights',
    send_to_editor: 'Send to editor',
    submit_for_review: 'Submit for review',
    approve: 'Approve',
    publish: 'Publish',
    supersede: 'Supersede',
    correct: 'Correct',
    retract: 'Retract',
  };
  const eventLocked = actions.length === 0 || item.state === 'published';
  return `
    <article class="review-record" id="record-${escapeHtml(item.id)}" data-record
      data-title="${escapeHtml(item.title.toLowerCase())}"
      data-state="${escapeHtml(item.state)}">
      <header class="record-header">
        <div>
          <p class="eyebrow">${escapeHtml(item.materiality)} · ${escapeHtml(item.occurredAt)}</p>
          <h2>${escapeHtml(item.title)}</h2>
          <p class="summary">${escapeHtml(item.summary)}</p>
        </div>
        <div class="state ${item.assessment.approvable ? 'state-pass' : 'state-blocked'}">
          <span>${escapeHtml(stateLabel)}</span>
          <strong>${item.assessment.approvable ? 'Gate clear' : `${item.assessment.blockers.length} blockers`}</strong>
        </div>
      </header>

      <div class="record-grid">
        <section aria-labelledby="${escapeHtml(item.id)}-facts">
          <h3 id="${escapeHtml(item.id)}-facts">Event facts</h3>
          <dl class="fact-grid">
            <div><dt>Location</dt><dd>${escapeHtml(item.location?.label ?? 'Missing')}</dd></div>
            <div><dt>Coordinates</dt><dd>${item.location ? `${item.location.latitude.toFixed(3)}, ${item.location.longitude.toFixed(3)}` : 'Missing'}</dd></div>
            <div><dt>Resolved entities</dt><dd>${item.entities.length}</dd></div>
            <div><dt>Evidence hosts</dt><dd>${coverage.sourceHosts.length}</dd></div>
            <div><dt>Claims linked</dt><dd>${coverage.linkedClaims}/${coverage.totalClaims}</dd></div>
            <div><dt>Primary source</dt><dd>${coverage.hasAuthoritativePrimary ? 'Present' : 'Missing'}</dd></div>
          </dl>
          <h3>Entities</h3>
          <ul class="plain-list">
            ${item.entities.map((entity) => `<li><strong>${escapeHtml(entity.name)}</strong><span>${escapeHtml(entity.type)} · ${escapeHtml(entity.id)}</span></li>`).join('')}
          </ul>
        </section>

        <section aria-labelledby="${escapeHtml(item.id)}-gate">
          <h3 id="${escapeHtml(item.id)}-gate">Publication gate</h3>
          ${item.assessment.blockers.length === 0
            ? '<p class="gate-clear">Every machine-checkable publication condition is satisfied.</p>'
            : `<ul class="issue-list">${item.assessment.blockers.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('')}</ul>`}
          ${item.assessment.warnings.length > 0
            ? `<h4>Review warnings</h4><ul class="warning-list">${item.assessment.warnings.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('')}</ul>`
            : ''}
          <h3>Known unknowns</h3>
          <ul class="plain-list compact">
            ${item.unknowns.map((unknown) => `<li>${escapeHtml(unknown)}</li>`).join('')}
          </ul>
        </section>
      </div>

      <section aria-labelledby="${escapeHtml(item.id)}-claims">
        <h3 id="${escapeHtml(item.id)}-claims">Claim ledger</h3>
        <div class="claim-ledger">${item.claims.map((claim) => renderClaim(claim, item)).join('')}</div>
      </section>

      <section aria-labelledby="${escapeHtml(item.id)}-graph">
        <h3 id="${escapeHtml(item.id)}-graph">Impact path candidates</h3>
        <ol class="path-list">
          ${item.impactPath.map((step) => `
            <li>
              <span class="path-index">${String(step.order).padStart(2, '0')}</span>
              <div><strong>${escapeHtml(step.label)}</strong><span>${escapeHtml(step.nodeType)} · ${escapeHtml(step.confidence)} confidence</span><p>${escapeHtml(step.mechanism)}</p></div>
            </li>`).join('')}
        </ol>
      </section>

      <form class="review-form" data-review-form data-event-id="${escapeHtml(item.id)}">
        <div>
          <label for="${escapeHtml(item.id)}-reviewer">Reviewer identity</label>
          <input id="${escapeHtml(item.id)}-reviewer" name="reviewer" autocomplete="name"
            value="${escapeHtml(item.reviewedBy ?? '')}" ${eventLocked ? 'disabled' : ''} required>
        </div>
        <div class="note-field">
          <label for="${escapeHtml(item.id)}-note">Decision note</label>
          <textarea id="${escapeHtml(item.id)}-note" name="note" rows="3"
            placeholder="State what was checked, what changed, and any remaining limit."
            ${eventLocked ? 'disabled' : ''} required></textarea>
        </div>
        <div class="review-actions">
          ${eventLocked
            ? '<p>This public-state record is locked. Corrections and retractions use a separate controlled transition.</p>'
            : actions.map((action) => `
              <button class="${action === 'approve' || action === 'publish' ? 'primary-action' : ''}"
                type="submit" name="action" value="${action}"
                ${action === 'approve' && !item.assessment.approvable ? 'disabled' : ''}>
                ${labels[action]}
              </button>`).join('')}
        </div>
      </form>
    </article>`;
}

function renderWorkbench(items: CommodityNodeEditorialWorkbenchItem[]): string {
  const pending = items.filter((item) => item.state !== 'published').length;
  const blockers = items.reduce((sum, item) => sum + item.assessment.blockers.length, 0);
  const data = JSON.stringify({
    generatedAt: new Date().toISOString(),
    itemCount: items.length,
    sourceCount: COMMODITYNODE_SOURCE_CATALOG.length,
  }).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <meta name="referrer" content="no-referrer">
  <meta name="commoditynode-csrf" content="__COMMODITYNODE_CSRF__">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%2307131a'/%3E%3Cpath d='M8 9h16v14H8z' fill='none' stroke='%2344c7bd' stroke-width='2'/%3E%3C/svg%3E">
  <title>CommodityNode Editorial Control</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #071017;
      --surface: #0c171f;
      --surface-2: #111f29;
      --line: #263844;
      --line-strong: #3a5362;
      --text: #edf3f5;
      --muted: #9baeb8;
      --teal: #44c7bd;
      --teal-dark: #173f40;
      --amber: #f0b45a;
      --red: #f17773;
      --max: 1500px;
      font-family: "Source Sans 3", "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    html { background: var(--bg); scroll-behavior: smooth; }
    body { margin: 0; color: var(--text); background: var(--bg); }
    a { color: #80d9d2; }
    button, input, textarea { font: inherit; }
    button, input, textarea { min-height: 44px; }
    button:focus-visible, input:focus-visible, textarea:focus-visible, a:focus-visible {
      outline: 3px solid var(--teal);
      outline-offset: 3px;
    }
    .skip-link { position: fixed; left: 1rem; top: -5rem; z-index: 100; padding: .75rem 1rem; background: var(--text); color: var(--bg); }
    .skip-link:focus { top: 1rem; }
    .topbar { border-bottom: 1px solid var(--line); background: #08131a; }
    .topbar-inner { width: min(calc(100% - 2rem), var(--max)); margin: auto; min-height: 70px; display: flex; align-items: center; justify-content: space-between; gap: 2rem; }
    .brand { display: flex; align-items: center; gap: .8rem; }
    .brand-mark { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--teal); color: var(--teal); font-weight: 800; }
    .brand strong { display: block; letter-spacing: -.01em; }
    .brand span, .privacy-note { color: var(--muted); font-size: .82rem; }
    .privacy-note { display: flex; align-items: center; gap: .5rem; }
    .privacy-note::before { content: ""; width: 8px; height: 8px; background: var(--teal); }
    .shell { width: min(calc(100% - 2rem), var(--max)); margin: 0 auto 6rem; }
    .overview { padding: 3.5rem 0 2rem; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3rem; align-items: end; }
    h1 { margin: 0; max-width: 18ch; font-size: clamp(2.3rem, 5vw, 4.8rem); line-height: .98; letter-spacing: -.055em; }
    .overview-copy { max-width: 70ch; margin: 1.25rem 0 0; color: var(--muted); font-size: 1.08rem; line-height: 1.65; }
    .eyebrow { margin: 0 0 .65rem; color: var(--teal); font: 700 .75rem/1.2 "IBM Plex Mono", monospace; letter-spacing: .12em; text-transform: uppercase; }
    .metrics { display: grid; grid-template-columns: repeat(3, minmax(105px, 1fr)); border: 1px solid var(--line); }
    .metrics div { min-width: 120px; padding: 1rem 1.2rem; border-left: 1px solid var(--line); }
    .metrics div:first-child { border-left: 0; }
    .metrics strong { display: block; font: 700 1.65rem/1 "IBM Plex Mono", monospace; }
    .metrics span { display: block; margin-top: .4rem; color: var(--muted); font-size: .78rem; }
    .toolbar { position: sticky; top: 0; z-index: 20; display: grid; grid-template-columns: 1fr auto; gap: 1rem; padding: 1rem 0; background: color-mix(in srgb, var(--bg) 94%, transparent); border-bottom: 1px solid var(--line); }
    .search { display: flex; align-items: center; gap: .7rem; }
    .search input, .filter { width: 100%; padding: .7rem .8rem; color: var(--text); background: var(--surface); border: 1px solid var(--line-strong); border-radius: 0; }
    .filter { width: auto; }
    .workspace { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 1.5rem; margin-top: 1.5rem; align-items: start; }
    .records { display: grid; gap: 1.5rem; min-width: 0; }
    .review-record { border: 1px solid var(--line); background: var(--surface); }
    .record-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2rem; padding: 1.6rem; border-bottom: 1px solid var(--line); }
    .record-header h2 { margin: 0; font-size: clamp(1.65rem, 3vw, 2.35rem); line-height: 1.05; letter-spacing: -.035em; }
    .summary { max-width: 75ch; margin: .9rem 0 0; color: var(--muted); line-height: 1.55; }
    .state { align-self: start; min-width: 145px; padding: .85rem; border: 1px solid var(--line-strong); }
    .state span, .state strong { display: block; }
    .state span { color: var(--muted); font: 600 .72rem/1.2 "IBM Plex Mono", monospace; text-transform: uppercase; }
    .state strong { margin-top: .45rem; }
    .state-pass { border-color: #2f756f; background: #0c2828; }
    .state-blocked { border-color: #72553b; background: #251d14; }
    .record-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .record-grid > section, .review-record > section { padding: 1.5rem; border-bottom: 1px solid var(--line); }
    .record-grid > section + section { border-left: 1px solid var(--line); }
    h3 { margin: 0 0 1rem; font-size: .82rem; letter-spacing: .11em; text-transform: uppercase; color: #bfd0d8; }
    h4 { margin: 1.25rem 0 .6rem; }
    .fact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin: 0 0 1.5rem; background: var(--line); border: 1px solid var(--line); }
    .fact-grid div { padding: .8rem; background: var(--surface-2); }
    dt { color: var(--muted); font-size: .75rem; }
    dd { margin: .25rem 0 0; font-weight: 650; }
    .plain-list, .issue-list, .warning-list { margin: 0; padding: 0; list-style: none; display: grid; gap: .65rem; }
    .plain-list li { display: flex; justify-content: space-between; gap: 1rem; padding-bottom: .65rem; border-bottom: 1px solid var(--line); }
    .plain-list span { color: var(--muted); text-align: right; }
    .plain-list.compact li { display: block; color: var(--muted); line-height: 1.45; }
    .issue-list li, .warning-list li, .gate-clear { padding: .8rem; margin: 0; background: #261c18; border-left: 3px solid var(--red); line-height: 1.4; }
    .warning-list li { background: #252116; border-color: var(--amber); }
    .gate-clear { background: #102a28; border-color: var(--teal); }
    .claim-ledger { display: grid; gap: .75rem; }
    .ledger-item { padding: 1rem; background: var(--surface-2); border: 1px solid var(--line); }
    .ledger-item p { margin: .5rem 0 .8rem; line-height: 1.5; }
    .ledger-id { color: var(--teal); font: 700 .72rem/1.2 "IBM Plex Mono", monospace; }
    .evidence-links { display: grid; gap: .35rem; }
    .evidence-links a { font-size: .82rem; line-height: 1.4; overflow-wrap: anywhere; }
    .path-list { list-style: none; margin: 0; padding: 0; display: grid; }
    .path-list li { display: grid; grid-template-columns: 46px 1fr; gap: .8rem; padding: 1rem 0; border-bottom: 1px solid var(--line); }
    .path-index { color: var(--teal); font: 700 .82rem/1.2 "IBM Plex Mono", monospace; }
    .path-list strong, .path-list span { display: block; }
    .path-list span { color: var(--muted); font-size: .78rem; }
    .path-list p { margin: .45rem 0 0; color: #c4d0d5; line-height: 1.45; }
    .review-form { display: grid; grid-template-columns: minmax(180px, .7fr) minmax(260px, 1.5fr); gap: 1rem; padding: 1.5rem; background: #09141b; }
    label { display: block; margin-bottom: .4rem; color: var(--muted); font-size: .78rem; }
    input, textarea { width: 100%; padding: .7rem .8rem; color: var(--text); background: var(--surface); border: 1px solid var(--line-strong); border-radius: 0; resize: vertical; }
    .review-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; align-items: center; gap: .65rem; }
    .review-actions p { margin: 0 auto 0 0; color: var(--muted); }
    button { padding: .65rem 1rem; color: var(--text); background: var(--surface-2); border: 1px solid var(--line-strong); cursor: pointer; border-radius: 0; }
    button:hover:not(:disabled) { border-color: var(--teal); }
    button:disabled { cursor: not-allowed; opacity: .45; }
    .primary-action { color: #061312; background: var(--teal); border-color: var(--teal); font-weight: 800; }
    .governance { position: sticky; top: 78px; display: grid; gap: 1rem; }
    .governance section { padding: 1rem; border: 1px solid var(--line); background: var(--surface); }
    .governance p, .governance li { color: var(--muted); line-height: 1.45; }
    .governance ul { margin: 0; padding-left: 1.1rem; }
    .source-section { margin-top: 2.5rem; padding-top: 2rem; border-top: 1px solid var(--line); overflow-x: auto; }
    table { width: 100%; min-width: 900px; border-collapse: collapse; background: var(--surface); }
    th, td { padding: .8rem; text-align: left; border: 1px solid var(--line); }
    th { color: var(--muted); font-size: .74rem; text-transform: uppercase; letter-spacing: .08em; }
    td span { display: block; margin-top: .2rem; color: var(--muted); font-size: .78rem; }
    [hidden] { display: none !important; }
    #live-region { position: fixed; left: -9999px; }
    @media (max-width: 1040px) {
      .overview { grid-template-columns: 1fr; }
      .workspace { grid-template-columns: 1fr; }
      .governance { position: static; grid-template-columns: repeat(3, 1fr); order: -1; }
    }
    @media (max-width: 720px) {
      .topbar-inner { align-items: flex-start; padding: 1rem 0; flex-direction: column; gap: .65rem; }
      .overview { padding-top: 2.4rem; }
      .metrics { grid-template-columns: 1fr; width: 100%; }
      .metrics div, .metrics div:first-child { border: 0; border-top: 1px solid var(--line); }
      .metrics div:first-child { border-top: 0; }
      .toolbar { grid-template-columns: 1fr; top: 0; }
      .search { display: grid; gap: .4rem; }
      .filter { width: 100%; }
      .record-header, .record-grid, .review-form { grid-template-columns: 1fr; }
      .record-grid > section + section { border-left: 0; }
      .state { width: 100%; }
      .review-actions { grid-column: auto; align-items: stretch; flex-direction: column; }
      .governance { grid-template-columns: 1fr; }
      .plain-list li { display: block; }
      .plain-list span { margin-top: .25rem; text-align: left; }
    }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#review-queue">Skip to review queue</a>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand"><span class="brand-mark" aria-hidden="true">CN</span><div><strong>CommodityNode</strong><span>Editorial Control</span></div></div>
      <div class="privacy-note">Loopback-only workspace · never deployed with the public site</div>
    </div>
  </header>
  <main class="shell">
    <section class="overview" aria-labelledby="page-title">
      <div>
        <p class="eyebrow">Evidence before interface</p>
        <h1 id="page-title">Review every claim before it becomes a signal.</h1>
        <p class="overview-copy">This local workbench joins event facts, exact source locators, resolved entities, graph candidates, rights checks, and named decisions. Approval never publishes automatically.</p>
      </div>
      <div class="metrics" aria-label="Queue summary">
        <div><strong>${items.length}</strong><span>records loaded</span></div>
        <div><strong>${pending}</strong><span>not published</span></div>
        <div><strong>${blockers}</strong><span>open blockers</span></div>
      </div>
    </section>

    <div class="toolbar" aria-label="Queue filters">
      <div class="search">
        <label for="queue-search">Find a record</label>
        <input id="queue-search" type="search" placeholder="Search title or event id">
      </div>
      <select class="filter" id="state-filter" aria-label="Filter by editorial state">
        <option value="all">All states</option>
        <option value="needs_review">Needs review</option>
        <option value="published">Published</option>
      </select>
    </div>

    <div class="workspace">
      <section class="records" id="review-queue" aria-label="Editorial review queue">
        ${items.map(renderEvent).join('')}
      </section>
      <aside class="governance" aria-label="Review safeguards">
        <section><h3>No automatic publication</h3><p>Review actions create a local decision record. A separate controlled step changes public content.</p></section>
        <section><h3>Material-event rule</h3><p>Use an authoritative primary source or independent source diversity, exact location, resolved entities, and stated unknowns.</p></section>
        <section><h3>Rights boundary</h3><p>Source access is not republication permission. Full text remains outside the public payload.</p></section>
      </aside>
    </div>

    <section class="source-section" aria-labelledby="source-catalog-title">
      <p class="eyebrow">Collection allowlist</p>
      <h2 id="source-catalog-title">Reviewed source catalog</h2>
      <table>
        <thead><tr><th>Source</th><th>Authority</th><th>Transport</th><th>Collection</th><th>Preset scope</th><th>Rights review</th></tr></thead>
        <tbody>${renderSourceTable()}</tbody>
      </table>
    </section>
  </main>
  <div id="live-region" role="status" aria-live="polite"></div>
  <script type="application/json" id="workbench-metadata">${data}</script>
  <script>
    (() => {
      const search = document.querySelector('#queue-search');
      const state = document.querySelector('#state-filter');
      const records = [...document.querySelectorAll('[data-record]')];
      const live = document.querySelector('#live-region');
      const csrf = document.querySelector('meta[name="commoditynode-csrf"]').content;

      const filter = () => {
        const query = search.value.trim().toLowerCase();
        const selected = state.value;
        let visible = 0;
        records.forEach((record) => {
          const matchesText = !query || record.dataset.title.includes(query) || record.id.includes(query);
          const matchesState = selected === 'all' || record.dataset.state === selected;
          record.hidden = !(matchesText && matchesState);
          if (!record.hidden) visible += 1;
        });
        live.textContent = visible + ' review records shown.';
      };
      search.addEventListener('input', filter);
      state.addEventListener('change', filter);

      document.querySelectorAll('[data-review-form]').forEach((form) => {
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const submitter = event.submitter;
          if (!(submitter instanceof HTMLButtonElement)) return;
          const body = {
            eventId: form.dataset.eventId,
            reviewer: new FormData(form).get('reviewer'),
            note: new FormData(form).get('note'),
            action: submitter.value,
          };
          submitter.disabled = true;
          live.textContent = 'Saving review decision.';
          try {
            const response = await fetch('/api/review', {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-commoditynode-csrf': csrf },
              body: JSON.stringify(body),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Review decision failed.');
            live.textContent = 'Decision saved locally: ' + result.decision.toState + '.';
            form.querySelector('textarea').value = '';
            window.setTimeout(() => window.location.reload(), 350);
          } catch (error) {
            live.textContent = error instanceof Error ? error.message : 'Review decision failed.';
            alert(live.textContent);
          } finally {
            submitter.disabled = false;
          }
        });
      });
    })();
  </script>
</body>
</html>`;
}

export async function buildCommodityNodeEditorialWorkbench(
  outputDirectory = join(REPO_ROOT, '.commoditynode-private', 'editorial'),
  stateOverrides: ReadonlyMap<string, CommodityNodeEditorialState> = new Map(),
): Promise<{ outputDirectory: string; items: CommodityNodeEditorialWorkbenchItem[] }> {
  validateCommodityNodeSourceCatalog(COMMODITYNODE_SOURCE_CATALOG);
  const items = (await loadWorkbenchItems()).map((item) => {
    const state = stateOverrides.get(item.id);
    return state ? { ...item, state } : item;
  });
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(outputDirectory, 'index.html'), renderWorkbench(items), 'utf8'),
    writeFile(join(outputDirectory, 'queue.json'), `${JSON.stringify(items, null, 2)}\n`, 'utf8'),
  ]);
  return { outputDirectory, items };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const outputIndex = process.argv.indexOf('--output');
  const output = outputIndex >= 0 && process.argv[outputIndex + 1]
    ? resolve(process.argv[outputIndex + 1])
    : undefined;
  const result = await buildCommodityNodeEditorialWorkbench(output);
  console.log(JSON.stringify({
    status: 'pass',
    outputDirectory: result.outputDirectory,
    records: result.items.length,
    approvable: result.items.filter((item) => item.assessment.approvable).length,
  }, null, 2));
}
