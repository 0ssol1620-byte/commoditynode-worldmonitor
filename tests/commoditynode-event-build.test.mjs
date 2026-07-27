import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const root = new URL('../', import.meta.url);
const readDist = (path) => readFile(new URL(`blog-site/dist/${path}`, root), 'utf8');

describe('CommodityNode Event Pulse build', () => {
  it('publishes the reviewed Event Pulse index and evidence-backed detail', async () => {
    const [index, detail] = await Promise.all([
      readDist('events/index.html'),
      readDist('events/cobre-panama-production-halt/index.html'),
    ]);

    assert.match(index, /Published Event Pulses/);
    assert.match(index, /Cobre Panama production halt/);
    assert.match(index, /1 record passed the current gate/);
    assert.doesNotMatch(index, /Fictional copper disruption fixture/);

    assert.match(detail, /Historical event/);
    assert.match(detail, /Claim ledger/);
    assert.match(detail, /Supreme Court declares Law 406 unconstitutional/);
    assert.match(detail, /Observed supply interruption; price effect not isolated/);
    assert.match(detail, /cne_b697d84d/);
    assert.match(detail, /cobre-panama-supply-path-1200\.avif/);
    assert.match(detail, /cobre-panama-supply-path-1200\.webp/);
    assert.match(detail, /cobre-panama-supply-path-1200\.jpg/);
    assert.match(detail, /Illustrative visualization generated for CommodityNode/);
    assert.match(detail, /"primaryImageOfPage":\{"@type":"ImageObject"/);
    assert.match(detail, /<meta name="robots" content="index, follow/);
    assert.match(detail, /"@type":"NewsArticle"/);
    assert.match(detail, /"citation":\[/);
    assert.doesNotMatch(detail, /googlesyndication|adsbygoogle/);
  });

  it('never emits a route for reviewed fixture content', async () => {
    const [sitemap, imageSitemap, robots, llms, rss] = await Promise.all([
      readDist('sitemap-0.xml'),
      readDist('image-sitemap.xml'),
      readDist('robots.txt'),
      readDist('llms.txt'),
      readDist('rss.xml'),
    ]);
    assert.match(sitemap, /events\/cobre-panama-production-halt\//);
    assert.doesNotMatch(sitemap, /example-copper-disruption/);
    assert.match(imageSitemap, /cobre-panama-supply-path-1200\.jpg/);
    assert.match(imageSitemap, /Illustrative oblique view of an open-pit copper mine/);
    assert.doesNotMatch(imageSitemap, /example-copper-disruption/);
    assert.match(robots, /Sitemap: https:\/\/commoditynode\.com\/image-sitemap\.xml/);
    assert.match(llms, /## Event Pulses/);
    assert.match(llms, /events\/cobre-panama-production-halt\//);
    assert.match(rss, /events\/cobre-panama-production-halt\//);
    assert.doesNotMatch(llms, /Fictional copper disruption fixture/);
    assert.doesNotMatch(rss, /Fictional copper disruption fixture/);

    const search = JSON.parse(await readDist('search-index.json'));
    const eventRecords = search.records.filter((record) => record.type === 'event');
    assert.deepEqual(eventRecords.map((record) => record.id), [
      'event:cobre-panama-production-halt',
    ]);
  });
});
