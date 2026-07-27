import { getCollection } from 'astro:content';
import { absoluteUrl, belongsToActiveSite, postPath, site } from '../lib/site-variant';

export async function GET() {
  const posts = (await getCollection('blog'))
    .filter(belongsToActiveSite)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const lines = [
    `# ${site.publication}`,
    '',
    `> ${site.description}`,
    '',
    `Canonical index: ${absoluteUrl(site.indexPath)}`,
    `RSS feed: ${absoluteUrl(site.rssPath)}`,
    '',
    '## Articles',
    '',
    ...posts.flatMap((post) => [
      `- [${post.data.title}](${absoluteUrl(postPath(post.id))}): ${post.data.description}`,
      `  Published: ${post.data.pubDate.toISOString().slice(0, 10)}${post.data.modifiedDate ? `; updated: ${post.data.modifiedDate.toISOString().slice(0, 10)}` : ''}`,
    ]),
    '',
    '## Related machine-readable resources',
    '',
    `- [Live intelligence](${site.liveUrl})`,
    `- [Corresponding source](${site.sourceUrl})`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
