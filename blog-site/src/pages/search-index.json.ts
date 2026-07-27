import { getCollection } from 'astro:content';
import { belongsToActiveSite, postPath } from '../lib/site-variant';

export const prerender = true;

interface SearchRecord {
  id: string;
  type: 'commodity' | 'research' | 'policy';
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
    ...policyRecords,
  ].sort((a, b) => a.title.localeCompare(b.title));

  return new Response(JSON.stringify({ version: 1, records }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
