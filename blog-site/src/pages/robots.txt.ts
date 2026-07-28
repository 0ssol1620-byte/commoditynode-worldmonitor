import { absoluteUrl, isCommodityNode, site } from '../lib/site-variant';

export function GET() {
  const sitemap = isCommodityNode
    ? absoluteUrl('/sitemap-index.xml')
    : absoluteUrl('/blog/sitemap-index.xml');
  const imageSitemap = isCommodityNode
    ? absoluteUrl('/image-sitemap.xml')
    : undefined;
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${sitemap}`,
    ...(imageSitemap ? [`Sitemap: ${imageSitemap}`] : []),
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
