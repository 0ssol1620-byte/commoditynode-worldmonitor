import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import { buildCommodityNodeHealthDashboard } from '../scripts/build-commoditynode-health-dashboard.mts';

describe('CommodityNode private health dashboard build', () => {
  it('renders a local-only, fail-closed dashboard from an explicit observation file', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'commoditynode-health-'));
    const inputPath = resolve(directory, 'observations.json');
    const outputDirectory = resolve(directory, 'output');
    try {
      await writeFile(inputPath, JSON.stringify([{
        sourceId: 'eia',
        checkedAt: '2026-07-28T06:00:00Z',
        lastSuccessAt: '2026-07-28T05:58:00Z',
        state: 'healthy',
        latencyMs: 184,
        detail: 'Reviewed local transport observation.',
      }]), 'utf8');
      const result = await buildCommodityNodeHealthDashboard({
        inputPath,
        outputDirectory,
        now: '2026-07-28T06:00:00Z',
      });
      const [html, snapshotText] = await Promise.all([
        readFile(resolve(outputDirectory, 'index.html'), 'utf8'),
        readFile(resolve(outputDirectory, 'snapshot.json'), 'utf8'),
      ]);
      const snapshot = JSON.parse(snapshotText) as {
        counts: { current: number; unobserved: number };
      };

      assert.equal(result.snapshot.counts.current, 1);
      assert.equal(snapshot.counts.current, 1);
      assert.ok(snapshot.counts.unobserved > 0);
      assert.match(html, /noindex, nofollow, noarchive, nosnippet/);
      assert.match(html, /Reviewed local transport observation/);
      assert.doesNotMatch(html, /https?:\/\/|<script|<iframe/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects a non-array health input instead of silently showing healthy data', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'commoditynode-health-'));
    const inputPath = resolve(directory, 'observations.json');
    try {
      await writeFile(inputPath, '{"state":"healthy"}', 'utf8');
      await assert.rejects(
        buildCommodityNodeHealthDashboard({
          inputPath,
          outputDirectory: resolve(directory, 'output'),
        }),
        /must be a JSON array/,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
