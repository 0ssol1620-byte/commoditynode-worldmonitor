import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const rootPublic = resolve(root, 'public');
const researchPublic = resolve(root, 'blog-site', 'public');
const [sourceArgument, briefArgument, outputStemArgument] = process.argv.slice(2);

if (!sourceArgument || !briefArgument || !outputStemArgument) {
  throw new Error(
    'Usage: node scripts/process-commoditynode-event-visual.mjs <source> <brief> <public-output-stem>',
  );
}

const source = resolve(root, sourceArgument);
const briefPath = resolve(root, briefArgument);
const outputStem = resolve(root, outputStemArgument);
const publicRoot = outputStem.startsWith(researchPublic) ? researchPublic : rootPublic;
const brief = JSON.parse(await readFile(briefPath, 'utf8'));
const sourceBytes = await readFile(source);
const sourceMetadata = await sharp(sourceBytes).metadata();

if (!sourceMetadata.width || !sourceMetadata.height) {
  throw new Error('Source image dimensions are unavailable.');
}
if (sourceMetadata.width / sourceMetadata.height < 1.7) {
  throw new Error('Event visual source must be landscape and close to 16:9.');
}

await mkdir(dirname(outputStem), { recursive: true });

const variants = [];
for (const width of [640, 1200]) {
  const height = Math.round(width * 9 / 16);
  const base = sharp(sourceBytes)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .withMetadata({ orientation: 1 });
  const outputs = [
    {
      format: 'avif',
      path: `${outputStem}-${width}.avif`,
      pipeline: base.clone().avif({ quality: width === 1200 ? 58 : 54, effort: 5 }),
    },
    {
      format: 'webp',
      path: `${outputStem}-${width}.webp`,
      pipeline: base.clone().webp({ quality: width === 1200 ? 84 : 80, effort: 5 }),
    },
    {
      format: 'jpeg',
      path: `${outputStem}-${width}.jpg`,
      pipeline: base.clone().jpeg({ quality: width === 1200 ? 88 : 84, mozjpeg: true }),
    },
  ];

  for (const output of outputs) {
    const info = await output.pipeline.toFile(output.path);
    variants.push({
      format: output.format,
      width: info.width,
      height: info.height,
      bytes: info.size,
      path: output.path.slice(root.length).replaceAll('\\', '/'),
      publicUrl: output.path.slice(publicRoot.length).replaceAll('\\', '/'),
    });
  }
}

const blurBuffer = await sharp(sourceBytes)
  .resize(32, 18, { fit: 'cover', position: 'centre' })
  .webp({ quality: 32 })
  .toBuffer();
const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
const briefSha256 = createHash('sha256')
  .update(JSON.stringify(brief))
  .digest('hex');

const registry = {
  schemaVersion: 1,
  assetId: brief.id,
  eventId: brief.eventId,
  source: {
    path: source.slice(root.length).replaceAll('\\', '/'),
    filename: basename(source),
    width: sourceMetadata.width,
    height: sourceMetadata.height,
    sha256: sourceSha256,
  },
  generation: {
    provider: 'OpenAI',
    model: 'openai-built-in-image-generation',
    modelVersion: null,
    modelDisclosure: 'The built-in generation tool did not expose a model version.',
    generatedAt: '2026-07-28',
    briefPath: briefPath.slice(root.length).replaceAll('\\', '/'),
    briefSha256,
    referenceAssets: [],
  },
  rights: {
    status: 'generated_output_project_use',
    publicDisplay: true,
    referenceInputRights: 'not_applicable_no_reference_images',
    note: 'Generated for CommodityNode without external reference images; use remains subject to applicable OpenAI terms.',
  },
  review: {
    reviewer: 'CommodityNode Editorial',
    reviewedAt: '2026-07-28',
    textFree: true,
    noReadableLogos: true,
    noActualSceneClaim: true,
    disclosure: brief.disclosure,
  },
  variants,
  blurPlaceholder: `data:image/webp;base64,${blurBuffer.toString('base64')}`,
};

const registryPath = `${outputStem}.asset.json`;
await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  status: 'pass',
  registryPath: registryPath.slice(root.length).replaceAll('\\', '/'),
  sourceSha256,
  briefSha256,
  variants,
}, null, 2));
