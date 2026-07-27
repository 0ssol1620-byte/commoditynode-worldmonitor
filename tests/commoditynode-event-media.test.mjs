import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const registryPath = resolve(root, 'blog-site/public/images/events/cobre-panama-supply-path.asset.json');
const registry = JSON.parse(await readFile(registryPath, 'utf8'));

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

describe('CommodityNode Event Pulse media registry', () => {
  it('pins the generated source and visual brief by SHA-256', async () => {
    const source = await readFile(resolve(root, registry.source.path.replace(/^\//, '')));
    const briefBytes = await readFile(resolve(root, registry.generation.briefPath.replace(/^\//, '')));
    const brief = JSON.parse(briefBytes.toString('utf8'));

    assert.equal(sha256(source), registry.source.sha256);
    assert.equal(
      sha256(Buffer.from(JSON.stringify(brief))),
      registry.generation.briefSha256,
    );
    assert.deepEqual(registry.generation.referenceAssets, []);
    assert.equal(registry.rights.publicDisplay, true);
    assert.equal(registry.review.textFree, true);
    assert.equal(registry.review.noReadableLogos, true);
    assert.equal(registry.review.noActualSceneClaim, true);
    assert.match(registry.review.disclosure, /not a photograph/i);
  });

  it('ships deterministic AVIF, WebP and JPEG variants at both responsive widths', async () => {
    assert.equal(registry.variants.length, 6);
    assert.match(registry.blurPlaceholder, /^data:image\/webp;base64,/);

    for (const width of [640, 1200]) {
      const variants = registry.variants.filter((variant) => variant.width === width);
      assert.deepEqual(
        variants.map((variant) => variant.format).sort(),
        ['avif', 'jpeg', 'webp'],
      );
      for (const variant of variants) {
        assert.equal(variant.height, Math.round(width * 9 / 16));
        assert.equal(variant.publicUrl.startsWith('/images/events/'), true);
        const file = resolve(root, variant.path.replace(/^\//, ''));
        const metadata = await sharp(file).metadata();
        assert.equal(metadata.width, variant.width);
        assert.equal(metadata.height, variant.height);
      }
    }
  });
});
