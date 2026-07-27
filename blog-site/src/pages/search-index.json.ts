import { getCollection } from 'astro:content';
import { belongsToActiveSite, postPath } from '../lib/site-variant';
import { isPublishedCommodityEvent } from '../lib/published-events';

export const prerender = true;

interface SearchRecord {
  id: string;
  type: 'commodity' | 'event' | 'company' | 'research' | 'policy';
  title: string;
  description: string;
  url: string;
  terms: string[];
}

const policyRecords: SearchRecord[] = [
  {
    id: 'methodology',
    type: 'policy',
    title: 'Methodology',
    description: 'Claim types, timestamps, source thresholds, confidence, and graph rules.',
    url: '/methodology/',
    terms: ['methods', 'claims', 'evidence', 'timestamps', 'graph'],
  },
  {
    id: 'sources',
    type: 'policy',
    title: 'Sources and data rights',
    description: 'Source classes, attribution, rights, revisions, and derived indicators.',
    url: '/sources/',
    terms: ['provenance', 'rights', 'attribution', 'data'],
  },
  {
    id: 'editorial-policy',
    type: 'policy',
    title: 'Editorial policy',
    description: 'Publication, review, AI assistance, conflicts, and independence standards.',
    url: '/editorial-policy/',
    terms: ['editorial', 'review', 'ai', 'conflict', 'sponsor'],
  },
  {
    id: 'corrections',
    type: 'policy',
    title: 'Corrections',
    description: 'Correction levels, response workflow, and public correction log.',
    url: '/corrections/',
    terms: ['correction', 'error', 'revision', 'withdrawal'],
  },
];

export async function GET() {
  const commodities = await getCollection('commodities');
  const events = (await getCollection('events')).filter(isPublishedCommodityEvent);
  const companies = (await getCollection('companies')).filter(
    (company) =>
      company.data.publishable
      && company.data.publicationState === 'published'
      && !company.data.isFixture
      && company.data.evidence.length > 0,
  );
  const research = (await getCollection('blog')).filter(belongsToActiveSite);

  const records: SearchRecord[] = [
    ...commodities.map((commodity): SearchRecord => ({
      id: `commodity:${commodity.id}`,
      type: 'commodity',
      title: commodity.data.name,
      description: commodity.data.description,
      url: `/commodities/${commodity.id}/`,
      terms: [
        commodity.data.shortName,
        commodity.data.group,
        commodity.data.benchmark.name,
        commodity.data.benchmark.symbol,
        commodity.data.benchmark.unit,
        ...commodity.data.productionRegions,
        ...commodity.data.demandSectors,
      ],
    })),
    ...research.map((post): SearchRecord => ({
      id: `research:${post.id}`,
      type: 'research',
      title: post.data.title,
      description: post.data.description,
      url: postPath(post.id),
      terms: [post.data.keywords, post.data.audience],
    })),
    ...events.map((event): SearchRecord => ({
      id: `event:${event.id}`,
      type: 'event',
      title: event.data.title,
      description: event.data.summary,
      url: `/events/${event.id}/`,
      terms: [
        ...event.data.commodityIds,
        event.data.location.label,
        event.data.location.countryCode,
        event.data.eventType,
        event.data.direction,
        event.data.materiality,
        ...event.data.entities.flatMap((entity) => [entity.name, entity.type]),
      ],
    })),
    ...companies.map((company): SearchRecord => ({
      id: `company:${company.id}`,
      type: 'company',
      title: company.data.name,
      description: company.data.description,
      url: `/companies/${company.id}/`,
      terms: [
        company.data.ticker ?? '',
        company.data.country,
        company.data.exposureType,
        ...company.data.commodityIds,
        ...company.data.assets.flatMap((asset) => [asset.name, asset.type, asset.status]),
      ],
    })),
    ...policyRecords,
  ].sort((a, b) => a.title.localeCompare(b.title));

  return new Response(JSON.stringify({ version: 1, records }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
