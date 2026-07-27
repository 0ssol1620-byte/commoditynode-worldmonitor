import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '..');
const contentDir = resolve(root, 'blog-site', 'src', 'content', 'blog');
const adAllowlistSource = readFileSync(
  resolve(root, 'shared', 'commoditynode-route-policy.ts'),
  'utf8',
);
const failures = [];
const reviewed = [];

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

function parsePost(file) {
  const source = readFileSync(resolve(contentDir, file), 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    fail(file, 'frontmatter block is missing or malformed');
    return null;
  }
  return { data: parse(match[1]), body: match[2].trim() };
}

function words(body) {
  return body
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`#*_>|-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const genericAiPatterns = [
  /\bin today['’]s (?:fast-paced|rapidly evolving|digital) (?:world|landscape)\b/i,
  /\bdelve(?:s|d|ing)? into\b/i,
  /\b(?:rich|intricate) tapestry\b/i,
  /\bit is (?:important|worth noting) that\b/i,
  /\bnot just\b[^.!?\n]{0,120}\bbut (?:also )?\b/i,
  /\bgame[- ]changer\b/i,
  /\bunlock(?:s|ed|ing)? (?:the )?(?:power|potential)\b/i,
  /\bseamlessly\b/i,
];

for (const file of readdirSync(contentDir).filter((name) => name.endsWith('.md'))) {
  const parsed = parsePost(file);
  if (!parsed || parsed.data.site !== 'commoditynode') continue;
  const { data, body } = parsed;
  const slug = basename(file, '.md');

  for (const field of [
    'title',
    'description',
    'author',
    'authorUrl',
    'authorBio',
    'authorType',
    'reviewedBy',
    'reviewedAt',
    'publicationState',
    'editorialPurpose',
  ]) {
    if (!data[field]) fail(file, `${field} is required`);
  }

  if (data.authorType !== 'Organization' && data.authorType !== 'Person') {
    fail(file, 'authorType must be Person or Organization');
  }
  if (!String(data.authorUrl ?? '').startsWith('https://commoditynode.com/authors/')) {
    fail(file, 'authorUrl must point to a first-party accountability profile');
  }
  if (String(data.editorialPurpose ?? '').trim().length < 80) {
    fail(file, 'editorialPurpose must state a concrete reader outcome in at least 80 characters');
  }
  if (data.publicationState !== 'published') {
    fail(file, 'only published CommodityNode articles may remain in the public corpus');
  }
  if (data.indexable !== true) {
    fail(file, 'a published research article must explicitly declare indexable: true');
  }
  if (data.adEligible !== false) {
    fail(file, 'adEligible must remain false until the manual route allowlist is deliberately populated');
  }

  const publicationTime = Date.parse(data.pubDate);
  const reviewTime = Date.parse(data.reviewedAt);
  if (!Number.isFinite(publicationTime) || !Number.isFinite(reviewTime) || reviewTime < publicationTime) {
    fail(file, 'reviewedAt must be a valid date on or after pubDate');
  }

  const wordCount = words(body).length;
  if (wordCount < 300) fail(file, `article is too thin for this corpus (${wordCount} words)`);
  const firstParagraph = body.split(/\r?\n\r?\n/, 1)[0].replace(/\s+/g, ' ').trim();
  if (firstParagraph.length < 100) fail(file, 'opening paragraph must establish the reader problem directly');
  if ((body.match(/^##\s+/gm) ?? []).length < 2) fail(file, 'article needs at least two substantive sections');

  const externalLinks = [
    ...body.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g),
  ].map((match) => match[1]);
  if (externalLinks.length === 0) fail(file, 'at least one inspectable external source is required');
  if (externalLinks.some((url) => !url.startsWith('https://'))) {
    fail(file, 'external citations must use HTTPS');
  }

  if (/\b(?:lorem ipsum|coming soon|under construction|placeholder|TBD|TODO)\b/i.test(body)) {
    fail(file, 'placeholder or under-construction language is not publishable');
  }
  if (/\b(?:shocking|you won['’]t believe|secret they don['’]t want|guaranteed)\b/i.test(data.title)) {
    fail(file, 'clickbait title language is not publishable');
  }
  for (const pattern of genericAiPatterns) {
    if (pattern.test(body)) fail(file, `generic AI-writing pattern matched ${pattern}`);
  }

  const heroPath = String(data.heroImage ?? '').replace(/^\/+/, '');
  if (!heroPath || !existsSync(resolve(root, 'blog-site', 'public', heroPath))) {
    fail(file, 'committed hero image is missing');
  }
  if (!heroPath.includes(slug)) {
    fail(file, 'hero image filename must remain descriptive and slug-specific');
  }

  reviewed.push({
    slug,
    wordCount,
    externalSourceCount: externalLinks.length,
    reviewedAt: data.reviewedAt,
    adEligible: data.adEligible,
  });
}

if (!/export const COMMODITYNODE_AD_ELIGIBLE_POSTS = new Set<string>\(\);/.test(adAllowlistSource)) {
  failures.push('shared/commoditynode-route-policy.ts: ad allowlist must remain explicitly empty before approval');
}
if (reviewed.length < 3) failures.push(`Expected at least 3 reviewed CommodityNode articles; found ${reviewed.length}`);

if (failures.length > 0) {
  console.error(`[commoditynode-editorial] ${failures.length} publication gate failure(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({ status: 'pass', reviewed }, null, 2));
