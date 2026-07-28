import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PUBLIC_DIR = resolve(ROOT, 'public');
const WELL_KNOWN_DIR = resolve(PUBLIC_DIR, '.well-known');
const REPOSITORY = 'https://github.com/0ssol1620-byte/commoditynode-worldmonitor';
const UPSTREAM_REPOSITORY = 'https://github.com/koala73/worldmonitor';
const UPSTREAM_BASE_SHA = 'eb51542990b244fdde1314d6682f813c9e29ff70';

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

const repositoryHead = tryGit('rev-parse', 'HEAD');
const suppliedBuildSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMODITYNODE_BUILD_SHA;
const commitSha = (
  suppliedBuildSha
  || repositoryHead
  || ''
).trim();

if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
  throw new Error(`Invalid CommodityNode build SHA: ${commitSha}`);
}

if (process.env.CI || process.env.VERCEL) {
  if (repositoryHead && git('status', '--porcelain', '--untracked-files=no')) {
    throw new Error('Refusing a production provenance record from a dirty tracked worktree.');
  }
  if (!repositoryHead && !suppliedBuildSha) {
    throw new Error('A verified build SHA is required when Git metadata is unavailable.');
  }
}

const buildDate = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString();

const buildInfo = {
  schemaVersion: 1,
  product: 'CommodityNode',
  variant: 'commoditynode',
  commitSha,
  buildDate,
  repository: REPOSITORY,
  sourceUrl: `${REPOSITORY}/tree/${commitSha}`,
  sourceArchiveUrl: `${REPOSITORY}/archive/${commitSha}.zip`,
  upstream: {
    repository: UPSTREAM_REPOSITORY,
    baseSha: UPSTREAM_BASE_SHA,
  },
  licensePath: 'LICENSE',
  sourceOfferPath: '/source/',
};

mkdirSync(WELL_KNOWN_DIR, { recursive: true });
writeFileSync(
  resolve(WELL_KNOWN_DIR, 'commoditynode-build.json'),
  `${JSON.stringify(buildInfo, null, 2)}\n`,
);
copyFileSync(resolve(ROOT, 'SOURCE-OFFER.md'), resolve(PUBLIC_DIR, 'SOURCE-OFFER.md'));

console.log(`[commoditynode] build provenance ${commitSha}`);
