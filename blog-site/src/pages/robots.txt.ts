import { absoluteUrl, isCommodityNode, site } from '../lib/site-variant';

export function GET() {
  const sitemap = isCommodityNode
    ? absoluteUrl('/sitemap-index.xml')
    : absoluteUrl('/blog/sitemap-index.xml');
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${sitemap}`,
    `Host: ${site.origin}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
