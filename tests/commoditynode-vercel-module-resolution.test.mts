import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const COMMODITYNODE_FUNCTIONS = [
  'api/commoditynode-analytics.ts',
  'api/commoditynode-brief-request.ts',
  'api/commoditynode-capabilities.ts',
  'api/commoditynode-graph.ts',
  'api/commoditynode-legacy.ts',
  'api/commoditynode-newsletter.ts',
  'api/commoditynode-newsletter-confirm.ts',
  'api/commoditynode-newsletter-unsubscribe.ts',
] as const;
const VERCEL_FUNCTION_CLOSURE = [
  ...COMMODITYNODE_FUNCTIONS,
  'server/_shared/rate-limit.ts',
  'server/commoditynode/impact-graph-service.ts',
  'server/commoditynode/lead-contract.ts',
  'server/commoditynode/product-gateway.ts',
  'shared/commoditynode-analytics.ts',
  'shared/commoditynode-cobre-panama-impact.ts',
  'shared/commoditynode-entity-resolution.ts',
  'src/services/commodity-impact-graph.ts',
] as const;

const RELATIVE_IMPORT_RE =
  /(?:\bfrom\s+|\bimport\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
const EXPLICIT_RUNTIME_EXTENSION_RE = /\.(?:cjs|js|json|mjs)$/;

test('CommodityNode Vercel functions use Node ESM-resolvable relative imports', () => {
  for (const relativePath of VERCEL_FUNCTION_CLOSURE) {
    const source = readFileSync(`${ROOT}/${relativePath}`, 'utf8');
    const specifiers = [...source.matchAll(RELATIVE_IMPORT_RE)].map((match) => match[1]);
    for (const specifier of specifiers) {
      assert.match(
        specifier ?? '',
        EXPLICIT_RUNTIME_EXTENSION_RE,
        `${relativePath}: ${specifier} needs an explicit runtime extension; `
          + 'Vercel Node does not resolve extensionless ESM imports after transpilation.',
      );
    }
  }
});

test('CommodityNode Vercel functions explicitly use the Web Request-compatible edge runtime', () => {
  for (const relativePath of COMMODITYNODE_FUNCTIONS) {
    const source = readFileSync(`${ROOT}/${relativePath}`, 'utf8');
    assert.match(
      source,
      /export const config\s*=\s*\{\s*runtime:\s*['"]edge['"]\s*\}/,
      `${relativePath}: Web Request handlers must declare the Vercel edge runtime.`,
    );
  }
});
