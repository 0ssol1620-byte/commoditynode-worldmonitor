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

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadObservations(
  inputPath: string | undefined,
): Promise<CommodityNodeProviderObservation[]> {
  if (!inputPath) return [];
  const payload = JSON.parse(await readFile(resolve(inputPath), 'utf8')) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error('CommodityNode health input must be a JSON array.');
  }
  return payload as CommodityNodeProviderObservation[];
}

function renderDashboard(
  snapshot: ReturnType<typeof buildCommodityNodeHealthSnapshot>,
): string {
  const rows = snapshot.sources.map((source) => `
    <tr>
      <td><strong>${escapeHtml(source.sourceName)}</strong><span>${escapeHtml(source.publisher)}</span></td>
      <td><span class="state state-${escapeHtml(source.publicState)}">${escapeHtml(source.publicLabel)}</span></td>
      <td>${escapeHtml(source.category.replaceAll('_', ' '))}<span>${escapeHtml(source.cadence)}</span></td>
      <td>${source.lastSuccessAt ? escapeHtml(source.lastSuccessAt) : 'Not observed'}<span>${source.ageMinutes === null ? 'Age unavailable' : `${source.ageMinutes.toLocaleString()} min old`}</span></td>
      <td>${source.latencyMs === null ? 'Not measured' : `${source.latencyMs.toLocaleString()} ms`}<span>Checked ${escapeHtml(source.checkedAt ?? 'never')}</span></td>
      <td><span class="rights ${source.publicDisplayApproved ? 'rights-approved' : 'rights-held'}">${escapeHtml(source.rightsState.replaceAll('_', ' '))}</span><span>${source.publicDisplayApproved ? 'Public display approved' : 'Public display held'}</span></td>
      <td>${escapeHtml(source.detail)}</td>
    </tr>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <meta name="referrer" content="no-referrer">
  <title>CommodityNode Data Health</title>
  <style>
    :root { color-scheme: dark; --bg:#071017; --surface:#0c171f; --line:#263844; --text:#edf3f5; --muted:#9baeb8; --teal:#44c7bd; --amber:#f0b45a; --red:#f17773; font-family:"Source Sans 3","Segoe UI",sans-serif; }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--text); background:var(--bg); }
    .topbar { border-bottom:1px solid var(--line); background:#08131a; }
    .topbar div, main { width:min(calc(100% - 2rem), 1540px); margin:auto; }
    .topbar div { min-height:68px; display:flex; align-items:center; justify-content:space-between; gap:1rem; }
    .brand { font-weight:800; letter-spacing:-.02em; }
    .private { color:var(--muted); font-size:.82rem; }
    main { padding:3rem 0 5rem; }
    .eyebrow { margin:0 0 .7rem; color:var(--teal); font-size:.76rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
    h1 { margin:0; font-size:clamp(2.2rem,5vw,4.8rem); line-height:.96; letter-spacing:-.055em; }
    .lede { max-width:72ch; margin:1.2rem 0 0; color:var(--muted); font-size:1.05rem; line-height:1.65; }
    .metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:1px; margin:2.5rem 0; border:1px solid var(--line); background:var(--line); }
    .metric { padding:1.35rem; background:var(--surface); }
    .metric span { display:block; color:var(--muted); font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; }
    .metric strong { display:block; margin-top:.4rem; font-size:2rem; letter-spacing:-.04em; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); }
    table { width:100%; min-width:1180px; border-collapse:collapse; background:var(--surface); }
    th, td { padding:1rem; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    th { color:var(--muted); font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; background:#09151d; }
    td { font-size:.88rem; line-height:1.45; }
    td span:not(.state):not(.rights) { display:block; margin-top:.25rem; color:var(--muted); font-size:.78rem; }
    .state, .rights { display:inline-flex; min-height:28px; align-items:center; padding:0 .65rem; border:1px solid var(--line); font-size:.74rem; font-weight:800; letter-spacing:.04em; text-transform:uppercase; }
    .state-current, .rights-approved { border-color:#2d746f; color:#79d8d0; }
    .state-delayed { border-color:#7b6335; color:var(--amber); }
    .state-unavailable { border-color:#7f4141; color:var(--red); }
    .state-unobserved, .rights-held { color:var(--muted); }
    .footnote { margin:1rem 0 0; color:var(--muted); font-size:.82rem; }
    @media (max-width:760px) {
      .metrics { grid-template-columns:repeat(2,1fr); }
      .topbar div { align-items:flex-start; padding:1rem 0; flex-direction:column; }
      .table-wrap { overflow:visible; border:0; }
      table, tbody, tr, td { display:block; min-width:0; width:100%; }
      table { background:transparent; }
      thead { display:none; }
      tr { margin-bottom:1rem; border:1px solid var(--line); background:var(--surface); }
      td { display:grid; grid-template-columns:7.4rem minmax(0,1fr); gap:.7rem; padding:.8rem 1rem; border-bottom:1px solid var(--line); }
      td:last-child { border-bottom:0; }
      td::before { color:var(--muted); font-size:.7rem; font-weight:800; letter-spacing:.07em; text-transform:uppercase; }
      td:nth-child(1)::before { content:"Source"; }
      td:nth-child(2)::before { content:"Public state"; }
      td:nth-child(3)::before { content:"Class"; }
      td:nth-child(4)::before { content:"Last success"; }
      td:nth-child(5)::before { content:"Transport"; }
      td:nth-child(6)::before { content:"Rights"; }
      td:nth-child(7)::before { content:"Operator detail"; }
    }
  </style>
</head>
<body>
  <header class="topbar"><div><span class="brand">CommodityNode / Data Health</span><span class="private">Private · loopback only · no analytics</span></div></header>
  <main>
    <p class="eyebrow">Operational source control</p>
    <h1>Provider health without false certainty.</h1>
    <p class="lede">This private surface separates transport health, freshness age, and public-display rights. Missing observations remain unobserved; they are never promoted to a healthy state.</p>
    <section class="metrics" aria-label="Health summary">
      <div class="metric"><span>Current</span><strong>${snapshot.counts.current}</strong></div>
      <div class="metric"><span>Delayed</span><strong>${snapshot.counts.delayed}</strong></div>
      <div class="metric"><span>Unavailable</span><strong>${snapshot.counts.unavailable}</strong></div>
      <div class="metric"><span>Unobserved</span><strong>${snapshot.counts.unobserved}</strong></div>
    </section>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Source</th><th>Public state</th><th>Class</th><th>Last success</th><th>Transport</th><th>Rights</th><th>Operator detail</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="footnote">Generated ${escapeHtml(snapshot.generatedAt)} · Overall state: ${escapeHtml(snapshot.state)} · Operator detail is private and must not be copied into public status badges.</p>
  </main>
</body>
</html>`;
}

export async function buildCommodityNodeHealthDashboard(options: {
  outputDirectory?: string;
  inputPath?: string;
  now?: string;
} = {}): Promise<{
  outputDirectory: string;
  snapshot: ReturnType<typeof buildCommodityNodeHealthSnapshot>;
}> {
  const outputDirectory = resolve(
    options.outputDirectory
      ?? resolve(REPO_ROOT, '.commoditynode-private', 'health'),
  );
  const observations = await loadObservations(
    options.inputPath ?? process.env.COMMODITYNODE_HEALTH_INPUT,
  );
  const snapshot = buildCommodityNodeHealthSnapshot({
    sources: COMMODITYNODE_DATA_SOURCES,
    observations,
    now: options.now ?? new Date().toISOString(),
  });
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, 'index.html'), renderDashboard(snapshot), 'utf8'),
    writeFile(
      resolve(outputDirectory, 'snapshot.json'),
      `${JSON.stringify(snapshot, null, 2)}\n`,
      'utf8',
    ),
  ]);
  return { outputDirectory, snapshot };
}

const isDirectRun =
  process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  const result = await buildCommodityNodeHealthDashboard();
  console.log(
    `CommodityNode private health dashboard: ${result.outputDirectory} (${result.snapshot.state})`,
  );
}
