#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_UPSTREAM_REF = 'upstream/main';
const GENERATED_CONFLICTS = new Set(['docs/generated/stats.json']);

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function parseMergeTreeOutput(output) {
  const conflicts = [];
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const match = line.match(/^CONFLICT \(([^)]+)\): .* in (.+)$/);
    if (!match) continue;
    conflicts.push({ kind: match[1], path: match[2].trim() });
  }
  return conflicts;
}

export function classifyConflicts(conflicts, patchLedger) {
  const patches = Array.isArray(patchLedger?.patches) ? patchLedger.patches : [];
  const ledgerByPath = new Map();
  for (const patch of patches) {
    if (typeof patch?.upstreamFile !== 'string') continue;
    const ids = ledgerByPath.get(patch.upstreamFile) ?? [];
    ids.push(patch.id);
    ledgerByPath.set(patch.upstreamFile, ids);
  }

  return conflicts.map((conflict) => {
    const patchIds = ledgerByPath.get(conflict.path) ?? [];
    const generated = GENERATED_CONFLICTS.has(conflict.path);
    return {
      ...conflict,
      expected: generated || patchIds.length > 0,
      reason: generated ? 'regenerate' : patchIds.length > 0 ? 'patch-ledger' : 'unclassified',
      patchIds,
    };
  });
}

export function createRehearsalReport({
  forkHead,
  upstreamRef,
  upstreamHead,
  mergeBase,
  ahead,
  behind,
  mergeOutput,
  patchLedger,
}) {
  const conflicts = classifyConflicts(parseMergeTreeOutput(mergeOutput), patchLedger);
  const unexpectedConflicts = conflicts.filter((conflict) => !conflict.expected);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    forkHead,
    upstreamRef,
    upstreamHead,
    mergeBase,
    ahead,
    behind,
    conflicts,
    unexpectedConflicts,
    readyForReviewedSync: unexpectedConflicts.length === 0,
  };
}

function readArgs(argv) {
  const upstreamArg = argv.find((value) => value.startsWith('--upstream-ref='));
  return {
    upstreamRef: upstreamArg?.slice('--upstream-ref='.length) || DEFAULT_UPSTREAM_REF,
  };
}

function run() {
  const { upstreamRef } = readArgs(process.argv.slice(2));
  const patchLedger = parseYaml(
    readFileSync(resolve(ROOT, 'docs/fork/patch-ledger.yml'), 'utf8'),
  );
  const forkHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
  const upstreamHead = git(['rev-parse', upstreamRef]).stdout.trim();
  const mergeBase = git(['merge-base', forkHead, upstreamHead]).stdout.trim();
  const [aheadText, behindText] = git([
    'rev-list',
    '--left-right',
    '--count',
    `${forkHead}...${upstreamHead}`,
  ]).stdout.trim().split(/\s+/);
  const merge = git(['merge-tree', '--write-tree', forkHead, upstreamHead], {
    allowFailure: true,
  });
  const report = createRehearsalReport({
    forkHead,
    upstreamRef,
    upstreamHead,
    mergeBase,
    ahead: Number(aheadText),
    behind: Number(behindText),
    mergeOutput: `${merge.stdout}\n${merge.stderr}`,
    patchLedger,
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.readyForReviewedSync) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) run();
