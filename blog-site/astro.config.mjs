// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

const IS_COMMODITYNODE = process.env.PUBLIC_SITE_VARIANT === 'commoditynode';
const SITE_URL = IS_COMMODITYNODE
  ? 'https://commoditynode.com'
  : 'https://www.worldmonitor.app';
const BLOG_DIR = new URL('./src/content/blog/', import.meta.url);
const EVENTS_DIR = new URL('./src/content/events/', import.meta.url);

function readFrontmatterValue(markdown, key) {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return undefined;

  const match = frontmatter[1].match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm'));
  return match?.[1];
}

function setPostDate(postDates, pathname, date) {
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  postDates.set(normalized, date);
  postDates.set(normalized.slice(0, -1), date);
  postDates.set(`${SITE_URL}${normalized}`, date);
  postDates.set(`${SITE_URL}${normalized.slice(0, -1)}`, date);
}

function buildPostDateMap() {
  const postDates = new Map();
  let blogLastmod = '2026-06-10';
  let eventLastmod;

  for (const file of readdirSync(BLOG_DIR)) {
    if (!file.endsWith('.md')) continue;

    const slug = basename(file, '.md');
    const markdown = readFileSync(new URL(file, BLOG_DIR), 'utf8');
    const contentSite = readFrontmatterValue(markdown, 'site') || 'worldmonitor';
    if (IS_COMMODITYNODE ? contentSite !== 'commoditynode' : contentSite === 'commoditynode') {
      continue;
    }
    const date = readFrontmatterValue(markdown, 'modifiedDate')
      || readFrontmatterValue(markdown, 'pubDate');

    if (!date) continue;

    setPostDate(
      postDates,
      IS_COMMODITYNODE ? `/posts/${slug}/` : `/blog/posts/${slug}/`,
      date,
    );
    if (date > blogLastmod) blogLastmod = date;
  }

  setPostDate(postDates, IS_COMMODITYNODE ? '/' : '/blog/', blogLastmod);

  for (const file of readdirSync(EVENTS_DIR)) {
    if (!file.endsWith('.json')) continue;
    const event = JSON.parse(readFileSync(new URL(file, EVENTS_DIR), 'utf8'));
    if (event.status !== 'published' || event.isFixture || !event.publishedAt) continue;
    const slug = basename(file, '.json');
    const date = event.updatedAt || event.publishedAt;
    setPostDate(postDates, `/events/${slug}/`, date);
    if (!eventLastmod || date > eventLastmod) eventLastmod = date;
  }

  if (eventLastmod) {
    setPostDate(postDates, '/events/', eventLastmod);
    if (IS_COMMODITYNODE && eventLastmod > blogLastmod) {
      setPostDate(postDates, '/', eventLastmod);
    }
  }
  return postDates;
}

const POST_DATES = buildPostDateMap();

export default defineConfig({
  site: SITE_URL,
  base: IS_COMMODITYNODE ? '/' : '/blog',
  output: 'static',
  integrations: [
    sitemap({
      filter(page) {
        if (!IS_COMMODITYNODE) return true;
        return !/\/(?:authors\/elie-habib|glossary|search)(?:\/|$)/.test(new URL(page).pathname);
      },
      serialize(item) {
        const lastmod = POST_DATES.get(item.url);
        if (lastmod) return { ...item, lastmod };
        return item;
      },
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
