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

    await expect(page.locator('[data-panel="impact-universe"] [data-universe-node]')).toHaveCount(23);
    await expect(page.locator('[data-panel="impact-universe"]')).not.toContainText(/\bRL\b/);

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
  });
});
