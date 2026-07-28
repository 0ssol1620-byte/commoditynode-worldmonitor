import { describe, expect, it } from 'vitest';

import { resolveRuntimeSiteVariant } from '@/config/variant';

describe('runtime site variant resolution', () => {
  it('keeps a dedicated CommodityNode build on Vercel fallback and preview hosts', () => {
    expect(
      resolveRuntimeSiteVariant(
        'commoditynode-live.vercel.app',
        'commoditynode',
        null,
        false,
      ),
    ).toBe('commoditynode');
    expect(
      resolveRuntimeSiteVariant(
        'commoditynode-live-a1b2c3-team.vercel.app',
        'commoditynode',
        null,
        false,
      ),
    ).toBe('commoditynode');
  });

  it('keeps a recognized public hostname authoritative', () => {
    expect(
      resolveRuntimeSiteVariant(
        'finance.worldmonitor.app',
        'commoditynode',
        null,
        false,
      ),
    ).toBe('finance');
  });

  it('keeps local and desktop explicit choices authoritative', () => {
    expect(resolveRuntimeSiteVariant('localhost', 'commoditynode', 'energy', false)).toBe(
      'energy',
    );
    expect(resolveRuntimeSiteVariant('desktop.invalid', 'commoditynode', 'happy', true)).toBe(
      'happy',
    );
  });

  it('falls back to the full product for a general build on an unknown host', () => {
    expect(resolveRuntimeSiteVariant('example.invalid', 'full', null, false)).toBe('full');
  });
});
