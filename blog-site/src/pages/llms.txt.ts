import { getCollection } from 'astro:content';
import { absoluteUrl, belongsToActiveSite, postPath, site } from '../lib/site-variant';
import { isPublishedCommodityEvent, sortCommodityEventsByOccurrence } from '../lib/published-events';

export async function GET() {
  const posts = (await getCollection('blog'))
    .filter(belongsToActiveSite)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  const events = site.key === 'commoditynode'
    ? (await getCollection('events'))
        .filter(isPublishedCommodityEvent)
        .sort(sortCommodityEventsByOccurrence)
    : [];

  const lines = [
    `# ${site.publication}`,
    '',
    `> ${site.description}`,
    '',
    `Canonical index: ${absoluteUrl(site.indexPath)}`,
    `RSS feed: ${absoluteUrl(site.rssPath)}`,
    '',
    ...(site.key === 'commoditynode'
      ? [
          '## Commodity definitions',
          '',
          `- [Coverage directory](${absoluteUrl('/commodities/')}): reviewed benchmark contracts, symbols, units, provider semantics, and caveats`,
          `- [Event Pulse](${absoluteUrl('/events/')}): reviewed events with claim-level evidence, unknowns, and bounded impact paths`,
          `- [Methodology](${absoluteUrl('/methodology/')}): claim, timestamp, relationship, and publication rules`,
          `- [Sources](${absoluteUrl('/sources/')}): provenance and data-rights policy`,
          `- [Editorial policy](${absoluteUrl('/editorial-policy/')}): sourcing, review, AI-assistance, and conflicts`,
          `- [Corrections](${absoluteUrl('/corrections/')}): correction levels and public log`,
          `- [Contact](${absoluteUrl('/contact/')}): editorial, security, and accessibility channels`,
          '',
        ]
      : []),
    ...(events.length > 0
      ? [
          '## Event Pulses',
          '',
          ...events.flatMap((event) => [
            `- [${event.data.title}](${absoluteUrl(`/events/${event.id}/`)}): ${event.data.summary}`,
            `  Occurred: ${event.data.occurredAt.toISOString().slice(0, 10)}; updated: ${event.data.updatedAt.toISOString().slice(0, 10)}; materiality: ${event.data.materiality}`,
          ]),
          '',
        ]
      : []),
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
