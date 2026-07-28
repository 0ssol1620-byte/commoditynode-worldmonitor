import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyConflicts,
  createRehearsalReport,
  parseMergeTreeOutput,
} from '../scripts/rehearse-commoditynode-upstream-sync.mjs';

const mergeOutput = `
Auto-merging docs/generated/stats.json
CONFLICT (content): Merge conflict in docs/generated/stats.json
Auto-merging package.json
CONFLICT (content): Merge conflict in package.json
`;

const patchLedger = {
  patches: [
    { id: 'CNWM-016', upstreamFile: 'package.json' },
  ],
};

describe('CommodityNode upstream sync rehearsal', () => {
  it('extracts merge-tree conflicts without treating normal auto-merges as conflicts', () => {
    assert.deepEqual(parseMergeTreeOutput(mergeOutput), [
      { kind: 'content', path: 'docs/generated/stats.json' },
      { kind: 'content', path: 'package.json' },
    ]);
  });

  it('classifies generated artifacts and patch-ledger files as expected conflicts', () => {
    assert.deepEqual(classifyConflicts(parseMergeTreeOutput(mergeOutput), patchLedger), [
      {
        kind: 'content',
        path: 'docs/generated/stats.json',
        expected: true,
        reason: 'regenerate',
        patchIds: [],
      },
      {
        kind: 'content',
        path: 'package.json',
        expected: true,
        reason: 'patch-ledger',
        patchIds: ['CNWM-016'],
      },
    ]);
  });

  it('fails closed when a conflict is neither generated nor registered', () => {
    const report = createRehearsalReport({
      forkHead: 'fork',
      upstreamRef: 'upstream/main',
      upstreamHead: 'upstream',
      mergeBase: 'base',
      ahead: 1,
      behind: 1,
      mergeOutput: 'CONFLICT (content): Merge conflict in src/unowned.ts',
      patchLedger,
    });
    assert.equal(report.readyForReviewedSync, false);
    assert.equal(report.unexpectedConflicts[0].path, 'src/unowned.ts');
  });
});
