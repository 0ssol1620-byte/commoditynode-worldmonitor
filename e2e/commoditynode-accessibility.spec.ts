import AxeBuilder from '@axe-core/playwright';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const researchRoot = resolve(import.meta.dirname, '../public/commoditynode-site');
const researchPaths = [
  '/',
  '/about/',
  '/authors/commoditynode-editorial/',
  '/brief/',
  '/developers/',
  '/plans/',
  '/commodities/',
  '/commodities/cocoa/',
  '/commodities/copper/',
  '/commodities/crude-oil/',
  '/commodities/gold/',
  '/companies/',
  '/companies/first-quantum-minerals/',
  '/contact/',
  '/corrections/',
  '/editorial-policy/',
  '/events/',
  '/events/cobre-panama-production-halt/',
  '/methodology/',
  '/posts/commodity-data-needs-two-timestamps/',
  '/posts/from-chokepoint-event-to-market-impact/',
  '/posts/read-commodity-relationship-graph/',
  '/privacy/',
  '/search/',
  '/sources/',
] as const;

const mimeByExtension: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function startResearchServer(): Promise<{ origin: string; close: () => Promise<void> }> {
  const server: Server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const decoded = decodeURIComponent(pathname);
    const relative = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
    const candidate = normalize(join(researchRoot, relative));
    const insideRoot = candidate === researchRoot || candidate.startsWith(`${researchRoot}${sep}`);

    if (!insideRoot || !existsSync(candidate) || !statSync(candidate).isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': mimeByExtension[extname(candidate)] ?? 'application/octet-stream',
    });
    createReadStream(candidate).pipe(response);
  });

  return new Promise((resolveServer, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('CommodityNode accessibility server did not bind.'));
        return;
      }
      resolveServer({
        origin: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((error) => {
              if (error) rejectClose(error);
              else resolveClose();
            });
          }),
      });
    });
  });
}

function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
): string {
  return violations
    .map(
      (violation) =>
        `${violation.id} [${violation.impact ?? 'unknown'}]: `
        + violation.nodes.map((node) => node.target.join(' ')).join(', '),
    )
    .join('\n');
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
}

test.describe('CommodityNode accessibility', () => {
  test('passes WCAG automated checks across every published research page', async ({ page }) => {
    test.setTimeout(300_000);
    const server = await startResearchServer();
    try {
      for (const path of researchPaths) {
        await test.step(path, async () => {
          await page.goto(`${server.origin}${path}`, { waitUntil: 'load' });
          await expectNoAxeViolations(page);
        });
      }
    } finally {
      await server.close();
    }
  });

  test('keeps lead forms fail-closed until the product capability contract is available', async ({
    page,
  }) => {
    const server = await startResearchServer();
    try {
      await page.goto(`${server.origin}/`, { waitUntil: 'load' });
      const newsletter = page.locator('[data-newsletter-form]');
      await expect(newsletter).toHaveAttribute('aria-busy', 'false');
      await expect(newsletter).toHaveAttribute('data-capability-ready', 'false');
      await expect(newsletter.getByRole('textbox', { name: 'Email address' })).toBeDisabled();
      await expect(newsletter.getByRole('button', { name: 'Request confirmation' })).toBeDisabled();
      await expect(newsletter.getByRole('status')).toHaveText(
        'Weekly brief signup is currently unavailable.',
      );

      await page.route('**/api/commoditynode-capabilities', async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          json: {
            version: 1,
            newsletter: { available: true },
            briefRequest: { available: true },
            accountFeatures: { available: false },
          },
        });
      });
      await page.goto(`${server.origin}/brief/`, { waitUntil: 'load' });
      const brief = page.locator('[data-brief-form]');
      await expect(brief).toHaveAttribute('aria-busy', 'false');
      await expect(brief).toHaveAttribute('data-capability-ready', 'true');
      await expect(brief.getByRole('textbox', { name: 'Name' })).toBeEnabled();
      await expect(brief.getByRole('button', { name: 'Submit request' })).toBeEnabled();
      await expect(brief.getByRole('status')).toBeEmpty();
    } finally {
      await page.goto('about:blank');
      await server.close();
    }
  });

  test('passes WCAG automated checks on the live shell and source offer', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const missionClose = page.getByRole('button', { name: 'Close mission presets' });
    if (await missionClose.isVisible()) await missionClose.click();
    await expect(page.locator('html')).toHaveAttribute('data-variant', 'commoditynode');
    await expectNoAxeViolations(page);

    await page.goto('/source/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Source Code' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('passes WCAG automated checks on the CommodityNode map embed', async ({ page }) => {
    await page.goto(
      '/embed?layers=miningSites,processingPlants,commodityPorts,commodityHubs,tradeRoutes'
      + '&center=15,10&zoom=1.2&theme=dark&variant=commoditynode',
    );
    await expect(page.locator('body')).toHaveAttribute('data-embed-ready', 'true');
    await expectNoAxeViolations(page);
  });
});
