import type { CollectionEntry } from 'astro:content';

export const isCommodityNode = import.meta.env.PUBLIC_SITE_VARIANT === 'commoditynode';

export const site = isCommodityNode
  ? {
      key: 'commoditynode',
      name: 'CommodityNode',
      publication: 'CommodityNode Research',
      origin: 'https://commoditynode.com',
      basePath: '',
      indexPath: '/',
      postsPath: '/posts',
      rssPath: '/rss.xml',
      description:
        'Source-linked research on commodity benchmarks, physical supply, trade routes, disruptions, and market transmission.',
      liveUrl: 'https://live.commoditynode.com',
      sourceUrl: 'https://github.com/0ssol1620-byte/commoditynode-worldmonitor',
      markUrl: '/commoditynode-mark.svg',
      ogImageUrl: 'https://commoditynode.com/og/commoditynode-impact-universe.svg',
      defaultAuthor: 'CommodityNode Editorial Desk',
      defaultSection: 'Commodity Impact Research',
    }
  : {
      key: 'worldmonitor',
      name: 'World Monitor',
      publication: 'World Monitor Blog',
      origin: 'https://www.worldmonitor.app',
      basePath: '/blog',
      indexPath: '/blog/',
      postsPath: '/blog/posts',
      rssPath: '/blog/rss.xml',
      description:
        'Analysis, guides, and deep dives on real-time intelligence, OSINT, geopolitics, markets, and the open-source tools behind World Monitor.',
      liveUrl: 'https://www.worldmonitor.app',
      sourceUrl: 'https://github.com/koala73/worldmonitor',
      markUrl: '/favico/favicon-32x32.png',
      ogImageUrl: 'https://www.worldmonitor.app/favico/og-image.png',
      defaultAuthor: 'Elie Habib',
      defaultSection: 'Global Intelligence',
    };

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, site.origin).href;
}

export function postPath(id: string): string {
  return `${site.postsPath}/${id}/`;
}

export function belongsToActiveSite(entry: CollectionEntry<'blog'>): boolean {
  return (entry.data.site ?? 'worldmonitor') === site.key
    && entry.data.publicationState === 'published';
}
