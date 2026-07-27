import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'docs', 'commoditynode', 'third-party-software-inventory.json');
const lockfiles = [
  'package-lock.json',
  'blog-site/package-lock.json',
  'consumer-prices-core/package-lock.json',
  'pro-test/package-lock.json',
  'scripts/package-lock.json',
].filter((file) => existsSync(resolve(root, file)));

const manualLicenses = new Map([
  ['@dodopayments/convex', {
    license: 'GPL-3.0',
    evidence: 'https://github.com/dodopayments/dodo-adapters/blob/main/LICENSE',
  }],
  ['@mapbox/jsonlint-lines-primitives', {
    license: 'MIT',
    evidence: 'https://github.com/mapbox/jsonlint/blob/release-mapbox-scoped/LICENSE',
  }],
  ['mailcheck', {
    license: 'MIT',
    evidence: 'https://github.com/mailcheck/mailcheck/blob/master/LICENSE',
  }],
  ['eyes', {
    license: 'MIT',
    evidence: 'https://www.npmjs.com/package/eyes/v/0.1.8',
  }],
  ['png-js', {
    license: 'MIT',
    evidence: 'https://github.com/foliojs/png.js/blob/master/LICENSE',
  }],
  ['text-encoding-utf-8', {
    license: '(Unlicense OR Apache-2.0)',
    evidence: 'https://github.com/inexorabletash/text-encoding/blob/master/LICENSE.md',
  }],
]);

function packageNameFromLockPath(packagePath) {
  const marker = 'node_modules/';
  const markerIndex = packagePath.lastIndexOf(marker);
  if (markerIndex < 0) return null;
  const segments = packagePath.slice(markerIndex + marker.length).split('/');
  return segments[0]?.startsWith('@') ? `${segments[0]}/${segments[1]}` : segments[0];
}

function normalizeLicense(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const values = value
      .map((entry) => typeof entry === 'string' ? entry : entry?.type)
      .filter((entry) => typeof entry === 'string' && entry.trim());
    if (values.length > 0) return values.join(' OR ');
  }
  return null;
}

function repositoryUrl(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value.url === 'string') return value.url;
  return null;
}

function compareCodePoints(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

const packageMap = new Map();
const manifestHash = createHash('sha256');

for (const lockfile of lockfiles) {
  const source = readFileSync(resolve(root, lockfile), 'utf8');
  manifestHash.update(lockfile);
  manifestHash.update('\0');
  manifestHash.update(source);
  manifestHash.update('\0');

  const lock = JSON.parse(source);
  for (const [packagePath, metadata] of Object.entries(lock.packages ?? {})) {
    const name = packageNameFromLockPath(packagePath);
    if (!name || !metadata?.version) continue;

    const key = `${name}@${metadata.version}`;
    const manual = manualLicenses.get(name);
    const lockLicense = normalizeLicense(metadata.license ?? metadata.licenses);
    const current = packageMap.get(key) ?? {
      name,
      version: metadata.version,
      license: lockLicense ?? manual?.license ?? 'NOASSERTION',
      licenseSource: lockLicense ? 'lockfile' : manual ? 'manual_review' : 'unresolved',
      licenseEvidence: manual?.evidence ?? null,
      repository: repositoryUrl(metadata.repository),
      homepage: typeof metadata.homepage === 'string' ? metadata.homepage : null,
      installRoots: new Set(),
    };

    current.installRoots.add(dirname(lockfile) === '.' ? 'root' : dirname(lockfile));
    packageMap.set(key, current);
  }
}

const packages = [...packageMap.values()]
  .map((entry) => ({
    ...entry,
    installRoots: [...entry.installRoots].sort(compareCodePoints),
  }))
  .sort(
    (a, b) =>
      compareCodePoints(a.name, b.name) ||
      compareCodePoints(a.version, b.version),
  );
const unresolved = packages.filter((entry) => entry.license === 'NOASSERTION');

const inventory = {
  schemaVersion: 1,
  generatedBy: relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/'),
  lockfiles,
  lockfileSetSha256: manifestHash.digest('hex'),
  packageCount: packages.length,
  unresolvedLicenseCount: unresolved.length,
  reviewRequired: unresolved.map((entry) => `${entry.name}@${entry.version}`),
  notes: [
    'This file inventories package metadata; it is not legal advice or a substitute for preserving license texts.',
    'NOASSERTION means the package lock and reviewed package metadata did not declare a machine-readable license.',
    'Data, media, trademarks, and provider terms are governed separately by DATA_SOURCES.md and the source registry.',
  ],
  packages,
};
const serialized = `${JSON.stringify(inventory, null, 2)}\n`;

if (process.argv.includes('--check')) {
  if (!existsSync(outputPath)) {
    console.error(`[commoditynode-license-inventory] Missing ${relative(root, outputPath)}`);
    process.exit(1);
  }
  const current = readFileSync(outputPath, 'utf8');
  if (current !== serialized) {
    console.error('[commoditynode-license-inventory] Inventory is stale. Run npm run commoditynode:licenses.');
    process.exit(1);
  }
  console.log(
    `[commoditynode-license-inventory] current: ${packages.length} packages, ${unresolved.length} NOASSERTION`,
  );
} else {
  writeFileSync(outputPath, serialized);
  console.log(
    `[commoditynode-license-inventory] wrote ${relative(root, outputPath)}: ${packages.length} packages, ${unresolved.length} NOASSERTION`,
  );
}
