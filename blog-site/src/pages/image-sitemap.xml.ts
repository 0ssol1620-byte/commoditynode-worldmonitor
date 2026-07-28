import { getCollection } from 'astro:content';
import { getCommodityEventMedia } from '../lib/event-media';
import { isPublishedCommodityEvent } from '../lib/published-events';
import {
  absoluteUrl,
  belongsToActiveSite,
  isCommodityNode,
  postPath,
} from '../lib/site-variant';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  if (!isCommodityNode) {
    return new Response('Not found', { status: 404 });
  }

  const posts = (await getCollection('blog')).filter(belongsToActiveSite);
  const events = (await getCollection('events')).filter(isPublishedCommodityEvent);
  const records = [
    ...posts
      .filter((post) => post.data.heroImage)
      .map((post) => ({
        pageUrl: absoluteUrl(postPath(post.id)),
        imageUrl: absoluteUrl(post.data.heroImage!),
        caption: post.data.title,
      })),
    ...events.flatMap((event) => {
      const media = getCommodityEventMedia(event.id);
      const image = media?.variants.find(
        (variant) => variant.format === 'jpeg' && variant.width === 1200,
      );
      if (!image || !event.data.visual) return [];
      return [{
        pageUrl: absoluteUrl(`/events/${event.id}/`),
        imageUrl: absoluteUrl(image.publicUrl),
        caption: event.data.visual.alt,
      }];
    }),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...records.map((record) => [
      '<url>',
      `<loc>${escapeXml(record.pageUrl)}</loc>`,
      '<image:image>',
      `<image:loc>${escapeXml(record.imageUrl)}</image:loc>`,
      `<image:caption>${escapeXml(record.caption)}</image:caption>`,
      '</image:image>',
      '</url>',
    ].join('')),
    '</urlset>',
    '',
  ].join('');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
