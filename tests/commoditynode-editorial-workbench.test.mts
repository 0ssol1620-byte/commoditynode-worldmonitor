import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { buildCommodityNodeEditorialWorkbench } from '../scripts/build-commoditynode-editorial-workbench.mts';

let outputDirectory = '';
let html = '';
let queue: Array<{ id: string; isFixture: boolean; assessment: { approvable: boolean } }> = [];

before(async () => {
  outputDirectory = await mkdtemp(join(tmpdir(), 'commoditynode-editorial-'));
  await buildCommodityNodeEditorialWorkbench(outputDirectory);
  html = await readFile(join(outputDirectory, 'index.html'), 'utf8');
  queue = JSON.parse(await readFile(join(outputDirectory, 'queue.json'), 'utf8'));
});

after(async () => {
  if (outputDirectory) await rm(outputDirectory, { recursive: true, force: true });
});

describe('CommodityNode private editorial workbench', () => {
  it('builds a noindex evidence, entity, graph, rights, and decision surface', () => {
    assert.match(html, /noindex, nofollow, noarchive, nosnippet/);
    assert.match(html, /Loopback-only workspace/);
    assert.match(html, /Event facts/);
    assert.match(html, /Claim ledger/);
    assert.match(html, /Impact path candidates/);
    assert.match(html, /Reviewed source catalog/);
    assert.match(html, /Approval never publishes automatically/);
    assert.doesNotMatch(html, /googlesyndication|adsbygoogle|google-analytics/);
  });

  it('includes fixtures for private gate QA but never marks them approvable', () => {
    const fixture = queue.find((item) => item.isFixture);
    assert.ok(fixture);
    assert.equal(fixture.assessment.approvable, false);
    assert.ok(queue.some((item) => item.id === 'cobre-panama-production-halt'));
  });
});
