import { expect, test } from '@playwright/test';

test.describe('CommodityNode live shell', () => {
  test('shows fork-safe identity, minimal panels, and a visible source offer', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('data-variant', 'commoditynode');
    await expect(page.locator('.app-heading')).toContainText('CommodityNode Live');
    await expect(page.locator('.logo')).toContainText('COMMODITYNODE');
    await expect(page.locator('.site-footer-name')).toHaveText('COMMODITYNODE');
    await expect(page.locator('.site-footer')).toContainText('Derived from World Monitor');

    for (const panel of ['impact-universe', 'event-pulse', 'commodities', 'supply-chain', 'route-risk', 'monitors']) {
      await expect(page.locator(`[data-panel="${panel}"]`)).toBeAttached();
    }

    await expect(page.locator('[data-panel="impact-universe"] .cn-universe-graph [data-universe-node]')).toHaveCount(23);
    await expect(page.locator('.cn-universe-graph-stage')).toBeVisible();
    await expect(page.locator('.cn-universe-webgl-canvas')).toBeAttached();
    await expect(page.locator('[data-panel="impact-universe"]')).not.toContainText(/\bRL\b/);
    await expect(page.locator('#cn-universe-case-title')).toHaveText(
      'Verified historical impact path',
    );
    await expect(page.locator('.cn-universe-evidence-drawer')).toContainText(
      'First Quantum Minerals',
    );
    await page
      .locator('[data-universe-evidence="edge-copper-supplies-industry"]')
      .click();
    await expect(page.locator('.cn-universe-evidence-drawer')).toContainText(
      'replacement supply',
    );
    await page
      .getByRole('button', { name: 'Show previous evidence snapshot', exact: true })
      .click();
    await expect(page.locator('.cn-universe-timeline-position')).toHaveText('3 / 4');
    await expect(page.locator('.cn-universe-timeline li[aria-current="step"]')).toContainText(
      '2024-01-15',
    );
    await expect(page.locator('.cn-universe-timeline-disclosure')).toContainText(
      'Retrospective reconstruction',
    );
    await page.getByRole('button', { name: 'Metals', exact: true }).click();
    await page.getByRole('button', { name: 'Accessible table', exact: true }).click();
    await expect(page.locator('.cn-universe-table tbody tr')).toHaveCount(4);
    await expect(page.locator('.cn-universe-table caption')).toContainText(
      'Industrial & transition metals',
    );
    await page.getByRole('button', { name: 'All 23', exact: true }).click();
    await page.getByRole('button', { name: 'Universe', exact: true }).click();
    await page.evaluate(() => {
      (window as typeof window & { __commodityNodeSelection?: string }).__commodityNodeSelection =
        '';
      window.addEventListener(
        'commoditynode:universe-selection',
        (event) => {
          const detail = (event as CustomEvent<{ commodityId?: string }>).detail;
          (
            window as typeof window & { __commodityNodeSelection?: string }
          ).__commodityNodeSelection = detail?.commodityId ?? '';
        },
        { once: true },
      );
    });
    await page.locator('.cn-universe-node[data-universe-node="gold"]').click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { __commodityNodeSelection?: string })
              .__commodityNodeSelection,
        ),
      )
      .toBe('gold');
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('commoditynode:map-selection', {
          detail: { commodityId: 'copper' },
        }),
      );
    });
    await expect(page.locator('#cn-universe-case-title')).toBeVisible();

    for (const panel of ['airline-intel', 'world-clock', 'polymarket', 'military-correlation']) {
      await expect(page.locator(`[data-panel="${panel}"]`)).toHaveCount(0);
    }

    await expect(page.locator('.pro-banner')).toHaveCount(0);
    await expect(page.locator('.community-widget')).toHaveCount(0);
    await expect(page.locator('[data-panel="market-implications"] .panel-pro-badge')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /military/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /conflicts/i })).toHaveCount(0);
    await expect(page.locator('.site-footer a[href="/source/"]')).toBeVisible();
  });

  test('source page maps the deployment to immutable source', async ({ page }) => {
    await page.goto('/source/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Source Code' })).toBeVisible();
    await expect(page.locator('#commit')).not.toHaveText('Loading…');
    await expect(page.locator('#source-link')).toHaveAttribute(
      'href',
      /github\.com\/0ssol1620-byte\/commoditynode-worldmonitor\/tree\/[0-9a-f]{40}$/,
    );
  });

  test('mobile shell stays on-brand, touch-safe, and within the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const hamburger = page.locator('#hamburgerBtn');
    await expect(hamburger).toBeVisible();
    await expect(hamburger).toHaveCSS('min-width', '44px');
    await hamburger.click();

    const menu = page.locator('#mobileMenu');
    await expect(menu).toContainText('COMMODITYNODE');
    await expect(menu).not.toContainText('WORLD MONITOR');
    await expect(menu).not.toContainText('Pricing');
    await expect(menu).not.toContainText('@eliehabib');
    await expect(menu.locator('a[href="/source/"]')).toBeVisible();

    const viewportMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(viewportMetrics.clientWidth);

    const searchFab = page.locator('#searchMobileFab');
    await expect(searchFab.locator('svg')).toBeAttached();
    await expect(searchFab).not.toContainText('🔍');

    const universeInspector = page.locator('.cn-universe-inspector');
    await expect(universeInspector).toBeAttached();
    const universeScroll = await universeInspector.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(universeScroll.scrollHeight).toBeGreaterThan(universeScroll.clientHeight);
    await expect(
      page.locator('[data-universe-evidence="edge-copper-supplies-industry"]'),
    ).toHaveCSS('min-height', '44px');
    await expect(
      page.getByRole('button', { name: 'All 23', exact: true }),
    ).toHaveCSS('min-height', '44px');
  });
});
