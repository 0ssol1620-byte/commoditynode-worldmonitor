import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { Window } from 'happy-dom';

const root = resolve(import.meta.dirname, '..');
const siteRoot = resolve(root, 'public', 'commoditynode-site');
const canonicalOrigin = 'https://commoditynode.com';
const sitemapPath = resolve(siteRoot, 'sitemap-0.xml');

const failures = [];
const pages = [];
const titleOwners = new Map();
const canonicalOwners = new Map();

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function routeFor(file) {
  const rel = relative(siteRoot, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  return `/${rel.replace(/index\.html$/, '')}`;
}

function normalizeWords(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function minimumWords(route) {
  if (route.startsWith('/posts/')) return 300;
  if (/^\/commodities\/[^/]+\/$/.test(route)) return 220;
  if (/^\/companies\/[^/]+\/$/.test(route)) return 180;
  if (/^\/events\/[^/]+\/$/.test(route)) return 180;
  if (route === '/') return 160;
  if ([
    '/about/',
    '/methodology/',
    '/sources/',
    '/editorial-policy/',
    '/corrections/',
    '/privacy/',
    '/developers/',
    '/plans/',
  ].includes(route)) return 100;
  if (/^\/authors\/[^/]+\/$/.test(route)) return 80;
  return 55;
}

function resolveInternalTarget(rawHref, route) {
  if (!rawHref || rawHref.startsWith('#')) return null;
  let url;
  try {
    url = new URL(rawHref, `${canonicalOrigin}${route}`);
  } catch {
    return { error: `malformed href ${JSON.stringify(rawHref)}` };
  }
  if (url.origin !== canonicalOrigin) return null;
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes('\0')) return { error: `NUL in href ${JSON.stringify(rawHref)}` };
  const candidates = [];
  if (pathname.endsWith('/')) {
    candidates.push(resolve(siteRoot, `.${pathname}`, 'index.html'));
  } else {
    candidates.push(resolve(siteRoot, `.${pathname}`));
    candidates.push(resolve(siteRoot, `.${pathname}`, 'index.html'));
  }
  const insideRoot = candidates.every(
    (candidate) => candidate === siteRoot || candidate.startsWith(`${siteRoot}${sep}`),
  );
  if (!insideRoot) return { error: `href escapes site root ${JSON.stringify(rawHref)}` };
  return candidates.some((candidate) => existsSync(candidate) && statSync(candidate).isFile())
    ? null
    : { error: `broken internal link ${rawHref}` };
}

if (!existsSync(siteRoot)) {
  console.error('CommodityNode research build is missing. Run npm run build:commoditynode first.');
  process.exit(1);
}
if (!existsSync(sitemapPath)) {
  console.error('CommodityNode sitemap-0.xml is missing.');
  process.exit(1);
}

const sitemapUrls = new Set(
  [...readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => match[1],
  ),
);
const htmlFiles = walk(siteRoot).filter(
  (file) => extname(file) === '.html' && file.endsWith(`${sep}index.html`),
);

for (const file of htmlFiles) {
  const route = routeFor(file);
  const source = readFileSync(file, 'utf8');
  const window = new Window({
    url: `${canonicalOrigin}${route}`,
    settings: { disableJavaScriptEvaluation: true },
  });
  const document = window.document;
  document.write(source);

  const title = document.title.trim();
  const description =
    document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '';
  const robots =
    document.querySelector('meta[name="robots"]')?.getAttribute('content')?.trim() ?? '';
  const canonical =
    document.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() ?? '';
  const redirect = Boolean(document.querySelector('meta[http-equiv="refresh"]'));
  const noindex = /\bnoindex\b/i.test(robots);
  const indexable = !noindex && !redirect;
  const canonicalUrl = `${canonicalOrigin}${route}`;

  const fail = (message) => failures.push(`${route}: ${message}`);

  if (!title || title.length < 15 || title.length > 75) {
    fail(`title length must be 15-75 characters (got ${title.length})`);
  }
  if (!redirect && (!description || description.length < 70 || description.length > 180)) {
    fail(`description length must be 70-180 characters (got ${description.length})`);
  }
  if (!robots) fail('explicit robots metadata is required');
  if (!canonical.startsWith(`${canonicalOrigin}/`) && canonical !== `${canonicalOrigin}/`) {
    fail(`canonical must use the CommodityNode apex (${canonical || 'missing'})`);
  }
  if (!redirect && canonical !== canonicalUrl) {
    fail(`canonical ${canonical || 'missing'} does not match ${canonicalUrl}`);
  }
  if (indexable && !sitemapUrls.has(canonical)) {
    fail('indexable canonical is missing from sitemap-0.xml');
  }
  if (!indexable && sitemapUrls.has(canonicalUrl)) {
    fail('noindex or redirect route must not appear in sitemap-0.xml');
  }

  if (!redirect) {
    const h1Count = document.querySelectorAll('h1').length;
    if (h1Count !== 1) fail(`expected exactly one h1, found ${h1Count}`);
  } else if (!noindex) {
    fail('redirect shells must be noindex');
  }

  if (indexable) {
    const main = document.querySelector('main');
    if (!main) {
      fail('indexable page is missing a main landmark');
    } else {
      const wordCount = normalizeWords(main.textContent).length;
      const minimum = minimumWords(route);
      if (wordCount < minimum) {
        fail(`main content is too thin (${wordCount} words; minimum ${minimum})`);
      }
    }
  }

  const visibleText = document.body.textContent ?? '';
  if (/\b(?:lorem ipsum|coming soon|under construction|placeholder|TBD|TODO)\b/i.test(visibleText)) {
    fail('placeholder or under-construction language is public');
  }
  if (/\b(?:delve(?:s|d|ing)? into|rich tapestry|game[- ]changer|unlock(?:s|ed|ing)? the potential)\b/i.test(visibleText)) {
    fail('generic AI-writing pattern is public');
  }
  if (/\b(?:Elie Habib|Someone™)\b/i.test(visibleText)) {
    fail('upstream author identity leaked into the CommodityNode research surface');
  }
  if (/googlesyndication|doubleclick|adsbygoogle|data-ad-client/i.test(source)) {
    fail('advertising code is present before the reviewed activation gate');
  }

  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      JSON.parse(script.textContent ?? '');
    } catch {
      fail('invalid JSON-LD block');
    }
  }
  if (indexable && document.querySelectorAll('script[type="application/ld+json"]').length === 0) {
    fail('indexable page is missing JSON-LD');
  }

  for (const anchor of document.querySelectorAll('a[href]')) {
    const href = anchor.getAttribute('href') ?? '';
    if (/^\s*javascript:/i.test(href)) {
      fail(`executable href ${JSON.stringify(href)}`);
      continue;
    }
    const verdict = resolveInternalTarget(href, route);
    if (verdict?.error) fail(verdict.error);
  }

  if (indexable) {
    const priorTitle = titleOwners.get(title);
    if (priorTitle) fail(`duplicate title also used by ${priorTitle}`);
    else titleOwners.set(title, route);
    const priorCanonical = canonicalOwners.get(canonical);
    if (priorCanonical) fail(`duplicate canonical also used by ${priorCanonical}`);
    else canonicalOwners.set(canonical, route);
  }

  pages.push({
    route,
    indexable,
    redirect,
    words: normalizeWords(document.querySelector('main')?.textContent).length,
    title,
  });
  window.close();
}

for (const sitemapUrl of sitemapUrls) {
  if (!canonicalOwners.has(sitemapUrl)) {
    failures.push(`sitemap: ${sitemapUrl} does not resolve to an audited indexable page`);
  }
}

if (failures.length > 0) {
  console.error(`[commoditynode-public-crawl] ${failures.length} failure(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const indexablePages = pages.filter((page) => page.indexable);
const noindexPages = pages.filter((page) => !page.indexable);
console.log(
  JSON.stringify(
    {
      status: 'pass',
      htmlPages: pages.length,
      indexablePages: indexablePages.length,
      noindexOrRedirectPages: noindexPages.length,
      sitemapUrls: sitemapUrls.size,
      minIndexableWords: Math.min(...indexablePages.map((page) => page.words)),
      maxIndexableWords: Math.max(...indexablePages.map((page) => page.words)),
      advertisingCodePresent: false,
    },
    null,
    2,
  ),
);
