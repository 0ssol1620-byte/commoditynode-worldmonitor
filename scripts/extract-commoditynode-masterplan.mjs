import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const inputPath = resolve(
  process.argv[2] ?? 'D:/CommodityNode_WorldMonitor_AGPL_Fork_Master_Architecture_2026-07-27_KO.md',
);
const outputDir = resolve(ROOT, 'docs/commoditynode');
const source = readFileSync(inputPath, 'utf8');
const lines = source.split(/\r?\n/);
const IMPLEMENTATION_STATUS = new Map([
  ['CNWM-001', 'complete'],
  ['CNWM-002', 'complete'],
  ['CNWM-003', 'complete'],
  ['CNWM-004', 'complete'],
  ['CNWM-005', 'complete'],
  ['CNWM-006', 'complete'],
  ['CNWM-007', 'complete'],
  ['CNWM-008', 'in_progress'],
  ['CNWM-009', 'complete'],
  ['CNWM-010', 'complete'],
  ['CNWM-011', 'complete'],
  ['CNWM-012', 'complete'],
  ['CNWM-013', 'complete'],
  ['CNWM-014', 'complete'],
  ['CNWM-015', 'complete'],
  ['CNWM-016', 'complete'],
  ['CNWM-017', 'complete'],
  ['CNWM-018', 'complete'],
  ['CNWM-019', 'in_progress'],
  ['CNWM-020', 'complete'],
  ['CNWM-021', 'complete'],
  ['CNWM-022', 'in_progress'],
  ['CNWM-023', 'complete'],
  ['CNWM-024', 'complete'],
  ['CNWM-034', 'complete'],
  ['CNWM-060', 'in_progress'],
  ['CNWM-110', 'in_progress'],
  ['CNWM-115', 'in_progress'],
]);

function cells(line) {
  return line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function csv(rows) {
  return `${rows.map((row) => row.map((value) => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(',')).join('\n')}\n`;
}

const matrixStart = lines.findIndex((line) => line.startsWith('# 6. '));
const matrixEnd = lines.findIndex((line, index) => index > matrixStart && line.startsWith('## 6.1'));
const matrixRows = lines
  .slice(matrixStart, matrixEnd)
  .filter((line) => line.startsWith('|') && !line.includes('---'))
  .map(cells)
  .filter((row) => row.length === 3 && row[0] !== '영역' && row[0] !== 'Area');

const backlogRows = lines
  .filter((line) => /^\|\s*CNWM-\d{3}\s*\|/.test(line))
  .map(cells)
  .filter((row) => row.length >= 6)
  .map((row) => [...row.slice(0, 6), IMPLEMENTATION_STATUS.get(row[0]) ?? 'planned']);

if (matrixRows.length < 20) {
  throw new Error(`Feature adoption matrix extraction is incomplete: ${matrixRows.length} rows`);
}
if (backlogRows.length !== 116) {
  throw new Error(`Expected 116 master backlog rows, extracted ${backlogRows.length}`);
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  resolve(outputDir, 'CommodityNode_WorldMonitor_Feature_Adoption_Matrix_2026-07-27.csv'),
  csv([
    ['area', 'decision', 'commoditynode_application'],
    ...matrixRows,
  ]),
);
writeFileSync(
  resolve(outputDir, 'CommodityNode_WorldMonitor_Implementation_Backlog_2026-07-27.csv'),
  csv([
    ['id', 'phase', 'workstream', 'task', 'priority', 'dependencies', 'implementation_status'],
    ...backlogRows,
  ]),
);
writeFileSync(
  resolve(outputDir, 'masterplan-extraction.json'),
  `${JSON.stringify({
    schemaVersion: 1,
    sourceFile: inputPath,
    sourceSha256: createHash('sha256').update(source).digest('hex'),
    extractedAt: new Date().toISOString(),
    featureMatrixRows: matrixRows.length,
    backlogRows: backlogRows.length,
  }, null, 2)}\n`,
);

console.log(`[commoditynode] extracted ${matrixRows.length} matrix rows and ${backlogRows.length} backlog rows`);
