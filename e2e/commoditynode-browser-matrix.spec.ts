import { expect, test, type Page } from '@playwright/test';

async function expectNoPageOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test.describe('CommodityNode browser and responsive matrix', () => {
  test('preserves the live product contract across engines, touch layouts, and accessibility modes', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const missionClose = page.getByRole('button', { name: 'Close mission presets' });
    if (await missionClose.isVisible()) await missionClose.click();

    await expect(page.locator('html')).toHaveClass(/wm-layout-hydrated/);
    await expect(page.locator('html')).toHaveAttribute('data-variant', 'commoditynode');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('CommodityNode Live - Commodity Impact Intelligence');
    await expect(page.locator('.app-heading')).toContainText('CommodityNode Live');
    await expect(page.locator('.logo')).toContainText('COMMODITYNODE');
    await expect(page.locator('.site-footer')).toContainText('Derived from World Monitor');
    await expect(page.locator('[data-panel="impact-universe"]')).toBeAttached();
    const universeGraphNodes = page.locator(
      '[data-panel="impact-universe"] .cn-universe-graph [data-universe-node]',
    );
    const universeTableRows = page.locator(
      '[data-panel="impact-universe"] .cn-universe-table tbody tr',
    );
    if (await universeGraphNodes.count()) {
      await expect(universeGraphNodes).toHaveCount(23);
    } else {
      // Narrow/touch layouts intentionally make the accessible table primary.
      await expect(universeTableRows).toHaveCount(23);
    }

    const eventMarker = page.locator('.cn-map-event-marker');
    await expect(page.locator('#mapContainer')).toBeVisible();
    await eventMarker.waitFor({ state: 'attached', timeout: 8_000 }).catch(() => undefined);
    if (await eventMarker.count()) {
      await expect(page.locator('.cn-map-event-marker__ring')).toHaveCSS(
        'animation-name',
        'none',
      );
    }
    await expectNoPageOverflow(page);
    expect(await page.locator('body').innerText()).not.toMatch(/[가-힣]/);

    const hamburger = page.locator('#hamburgerBtn');
    if (await hamburger.isVisible()) {
      await expect(hamburger).toHaveCSS('min-width', '44px');
      await expect(hamburger).toHaveCSS('min-height', '44px');
      await hamburger.click();
      await expect(page.locator('#mobileMenu')).toContainText('COMMODITYNODE');
      await expect(page.locator('#mobileMenu')).not.toContainText('Pricing');
      await page.getByRole('button', { name: 'Close menu' }).click();
    } else {
      await expect(
        page.getByRole('link', { name: 'RESEARCH', exact: true }),
      ).toBeVisible();
    }

    await page.addStyleTag({
      content: 'html { font-size: 200% !important; }',
    });
    await expect(page.locator('.app-heading')).toBeVisible();
    await expect(page.locator('[data-panel="impact-universe"]')).toBeAttached();
    await expectNoPageOverflow(page);
  });
});
