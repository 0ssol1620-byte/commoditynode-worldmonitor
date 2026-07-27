import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const REPOSITORY = 'https://github.com/0ssol1620-byte/commoditynode-worldmonitor';
const UPSTREAM_BASE_SHA = 'eb51542990b244fdde1314d6682f813c9e29ff70';
const UPSTREAM_LICENSE_BLOB = '0b1bbc64161c99612197d5017c98d037fa5c10d9';

function git(...args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function tryGit(...args) {
  try {
    return git(...args);
  } catch {
    return null;
  }
}

function gitBlobHash(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`);
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const buildInfo = JSON.parse(
  readFileSync(resolve(ROOT, 'public/.well-known/commoditynode-build.json'), 'utf8'),
);
const repositoryHead = tryGit('rev-parse', 'HEAD');
const expectedSha = (
  process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.COMMODITYNODE_BUILD_SHA
  || repositoryHead
  || ''
).trim();

assert(/^[0-9a-f]{40}$/i.test(expectedSha), 'A verified 40-character build SHA is required.');
assert(buildInfo.variant === 'commoditynode', 'Build variant must be commoditynode.');
assert(buildInfo.commitSha === expectedSha, 'Build-info commit does not match the deployed/checked-out SHA.');
assert(buildInfo.repository === REPOSITORY, 'Build-info repository is not the public fork.');
assert(buildInfo.sourceUrl === `${REPOSITORY}/tree/${expectedSha}`, 'Source URL is not immutable or does not match the build SHA.');
assert(buildInfo.sourceArchiveUrl === `${REPOSITORY}/archive/${expectedSha}.zip`, 'Source archive does not match the build SHA.');
assert(buildInfo.upstream?.baseSha === UPSTREAM_BASE_SHA, 'Frozen upstream base drifted.');

const licenseBytes = Buffer.from(
  readFileSync(resolve(ROOT, 'LICENSE'), 'utf8').replace(/\r\n/g, '\n'),
);
assert(
  gitBlobHash(licenseBytes) === UPSTREAM_LICENSE_BLOB,
  'LICENSE bytes no longer match the frozen upstream blob.',
);
if (repositoryHead) {
  const upstreamLicenseBlob = git('rev-parse', `${UPSTREAM_BASE_SHA}:LICENSE`);
  assert(upstreamLicenseBlob === UPSTREAM_LICENSE_BLOB, 'Recorded upstream LICENSE blob no longer matches the frozen base.');
  execFileSync('git', ['diff', '--quiet', UPSTREAM_BASE_SHA, '--', 'LICENSE'], { cwd: ROOT });
}

const notice = readFileSync(resolve(ROOT, 'NOTICE.md'), 'utf8');
const sourceOffer = readFileSync(resolve(ROOT, 'SOURCE-OFFER.md'), 'utf8');
const sourcePage = readFileSync(resolve(ROOT, 'public/source/index.html'), 'utf8');
assert(notice.includes(UPSTREAM_BASE_SHA), 'NOTICE.md must record the frozen upstream SHA.');
assert(sourceOffer.includes('/.well-known/commoditynode-build.json'), 'SOURCE-OFFER.md must expose build provenance.');
assert(sourcePage.includes('/.well-known/commoditynode-build.json'), 'The public source page must resolve deployed build provenance.');
assert(sourcePage.includes('Source Code'), 'The public source page must prominently identify source access.');

console.log('[commoditynode] license, attribution, variant, and deployed-source contracts pass');
