import { expect, test, type Locator, type Page } from '@playwright/test';

const SCREENSHOT_OPTIONS = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  scale: 'css' as const,
  maxDiffPixelRatio: 0.035,
};

async function prepareCommodityNode(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('worldmonitor-map-mode', 'flat');
    localStorage.setItem('wm-globe-render-scale', '1');
    localStorage.setItem('wm-globe-texture', 'topographic');
    localStorage.setItem('wm-globe-visual-preset', 'classic');
    localStorage.setItem('worldmonitor-mission-preset-dismissed-v1', '1');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const missionClose = page.getByRole('button', { name: 'Close mission presets' });
  await missionClose
    .waitFor({ state: 'visible', timeout: 5_000 })
    .catch(() => undefined);
  if (await missionClose.isVisible()) await missionClose.click();

  await expect(page.locator('html')).toHaveAttribute('data-variant', 'commoditynode');
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
      .commodity-ticker-track,
      .cn-map-event-marker__ring {
        animation: none !important;
        transform: none !important;
      }
      #headerClock {
        visibility: hidden !important;
      }
    `,
  });
}

async function waitForStableRenderer(
  page: Page,
  renderer: 'flat' | 'globe',
): Promise<Locator> {
  const map = page.locator('#mapContainer');
  const className =
    renderer === 'flat' ? '(?:deckgl|svg)-mode' : 'globe-mode';
  await expect(map).toHaveClass(
    new RegExp(`(?:^|\\s)${className}(?:\\s|$)`),
    { timeout: 45_000 },
  );
  if (renderer === 'globe') {
    await expect(map.locator('canvas').first()).toBeVisible({ timeout: 45_000 });
  } else {
    await expect(map.locator('canvas, svg').first()).toBeVisible({
      timeout: 45_000,
    });
  }
  await page.waitForTimeout(renderer === 'globe' ? 3_000 : 1_500);
  return map;
}

test.describe('CommodityNode deterministic visual baselines', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await prepareCommodityNode(page);
  });

  test('matches the analytical flat-map golden scene', async ({ page }) => {
    const mapSection = page.locator('#mapSection');
    await mapSection.scrollIntoViewIfNeeded();
    await waitForStableRenderer(page, 'flat');
    const firstHubMarker = page.locator('.commodity-hub-marker').first();
    await expect(firstHubMarker).toBeVisible();
    expect(
      await firstHubMarker.evaluate((element) =>
        Math.round(element.getBoundingClientRect().width),
      ),
    ).toBeLessThanOrEqual(20);

    await expect(mapSection).toHaveScreenshot('commoditynode-map-flat.png', {
      ...SCREENSHOT_OPTIONS,
      maxDiffPixelRatio: 0.045,
    });
  });

  test('matches the fixed 3D globe golden scene', async ({ page }) => {
    const mapSection = page.locator('#mapSection');
    await mapSection.scrollIntoViewIfNeeded();
    await waitForStableRenderer(page, 'flat');

    await page.locator('.map-dim-btn[data-mode="globe"]').click();
    await waitForStableRenderer(page, 'globe');
    await expect(
      page.locator('.globe-mode .cn-map-layer-group'),
    ).toHaveCount(3);
    await expect(
      page.locator('.globe-mode .map-author-badge'),
    ).toHaveCount(0);
    await expect(
      page.locator('#mapContainer [title="STRAIT OF HORMUZ"]'),
    ).toHaveText('');
    await expect(
      page.locator('.globe-mode .globe-beta-badge'),
    ).toBeHidden();

    await expect(mapSection).toHaveScreenshot('commoditynode-map-globe.png', {
      ...SCREENSHOT_OPTIONS,
      maxDiffPixelRatio: 0.025,
    });
  });

  test('matches the complete 23-instrument Impact Universe scene', async ({
    page,
  }) => {
    const universe = page.locator('[data-panel="impact-universe"]');
    await universe.scrollIntoViewIfNeeded();
    await expect(
      universe.locator('.cn-universe-graph [data-universe-node]'),
    ).toHaveCount(23);
    await expect(universe.locator('.cn-universe-graph-stage')).toBeVisible();

    await expect(universe).toHaveScreenshot('commoditynode-impact-universe.png', {
      ...SCREENSHOT_OPTIONS,
      maxDiffPixelRatio: 0.025,
    });
  });
});
