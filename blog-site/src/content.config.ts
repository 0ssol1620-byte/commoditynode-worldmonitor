import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import {
  COMMODITYNODE_EVENT_DIRECTIONS,
  COMMODITYNODE_EVENT_MATERIALITY,
  COMMODITYNODE_EVENT_TYPES,
} from '../../shared/commoditynode-event-extraction';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    metaTitle: z.string(),
    keywords: z.string(),
    audience: z.string(),
    pubDate: z.coerce.date(),
    modifiedDate: z.coerce.date().optional(),
    author: z.string().optional(),
    authorUrl: z.string().url().optional(),
    authorBio: z.string().optional(),
    authorType: z.enum(['Person', 'Organization']).optional(),
    reviewedBy: z.string().optional(),
    reviewedAt: z.coerce.date().optional(),
    publicationState: z.enum(['draft', 'reviewed', 'published']).default('published'),
    indexable: z.boolean().default(true),
    adEligible: z.boolean().default(false),
    editorialPurpose: z.string().min(80).optional(),
    heroImage: z.string().optional(),
    pinned: z.boolean().optional(),
    site: z.enum(['worldmonitor', 'commoditynode']).default('worldmonitor'),
  }),
});

const evidenceRef = z.object({
  label: z.string().min(2),
  url: z.string().url(),
  publisher: z.string().min(2),
  retrievedAt: z.coerce.date(),
});

const benchmarkContract = z.object({
  name: z.string(),
  symbol: z.string(),
  instrumentType: z.enum([
    'futures_benchmark',
    'regional_futures_benchmark',
    'etf_proxy',
  ]),
  exchange: z.string(),
  unit: z.string(),
  currency: z.string(),
  provider: z.string(),
  delayPolicy: z.string(),
  caveat: z.string().optional(),
});

const commodities = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/commodities' }),
  schema: z.object({
    name: z.string(),
    shortName: z.string(),
    description: z.string().min(80),
    group: z.enum(['energy', 'industrial-metals', 'precious-metals', 'agriculture']),
    coverage: z.enum(['live', 'partial', 'research-only', 'planned']),
    benchmark: benchmarkContract,
    productionRegions: z.array(z.string()).min(1),
    supplyStages: z.array(z.string()).min(2),
    demandSectors: z.array(z.string()).min(1),
    evidence: z.array(evidenceRef).min(1),
    reviewedBy: z.string(),
    reviewedAt: z.coerce.date(),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().min(120),
    occurredAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    publishedAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    commodityIds: z.array(z.string()).min(1),
    entities: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['mine', 'plant', 'port', 'route', 'company', 'industry', 'country']),
    })).min(1),
    location: z.object({
      id: z.string(),
      label: z.string(),
      countryCode: z.string().length(2),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
    eventType: z.enum(COMMODITYNODE_EVENT_TYPES),
    direction: z.enum(COMMODITYNODE_EVENT_DIRECTIONS),
    materiality: z.enum(COMMODITYNODE_EVENT_MATERIALITY),
    materialityRationale: z.string().min(80),
    status: z.enum(['candidate', 'reviewed', 'published', 'superseded', 'expired', 'rejected']),
    isFixture: z.boolean().default(false),
    fingerprint: z.string().regex(/^cne_[a-f0-9]{8}$/),
    claims: z.array(z.object({
      id: z.string(),
      type: z.enum([
        'verified_fact',
        'reported_claim',
        'calculated_metric',
        'analyst_inference',
        'scenario',
        'unknown',
      ]),
      text: z.string().min(20),
      evidenceIds: z.array(z.string()),
    })).min(1),
    evidence: z.array(z.object({
      id: z.string(),
      label: z.string().min(2),
      url: z.string().url(),
      publisher: z.string().min(2),
      retrievedAt: z.coerce.date(),
      kind: z.enum(['authoritative_primary', 'company_primary', 'independent_secondary']),
      locator: z.string().min(15),
      supportsClaims: z.array(z.string()).min(1),
    })).min(1),
    impactPath: z.array(z.object({
      order: z.number().int().positive(),
      nodeId: z.string(),
      label: z.string(),
      nodeType: z.enum(['event', 'mine', 'port', 'route', 'commodity', 'benchmark', 'company', 'industry']),
      mechanism: z.string().min(20),
      confidence: z.enum(['high', 'moderate', 'low']),
    })).min(2),
    timeline: z.array(z.object({
      date: z.coerce.date(),
      label: z.string().min(10),
      evidenceIds: z.array(z.string()).min(1),
    })).min(1),
    contradictingEvidence: z.array(z.string()),
    unknowns: z.array(z.string()).min(1),
    author: z.string(),
    authorUrl: z.string().url(),
    visual: z.object({
      assetId: z.string(),
      alt: z.string().min(60),
      disclosure: z.string().min(40),
    }).optional(),
    reviewedBy: z.string().optional(),
    reviewedAt: z.coerce.date().optional(),
  }),
});

const companies = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/companies' }),
  schema: z.object({
    name: z.string(),
    ticker: z.string().optional(),
    country: z.string(),
    description: z.string().min(120),
    commodityIds: z.array(z.string()).min(1),
    exposureType: z.enum(['producer', 'processor', 'transporter', 'consumer', 'diversified']),
    exposureMechanisms: z.array(z.string().min(40)).min(1),
    assets: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['mine', 'plant', 'port', 'route']),
      status: z.string(),
      asOf: z.coerce.date(),
      commodityIds: z.array(z.string()).min(1),
      evidenceIds: z.array(z.string()).min(1),
    })).min(1),
    relatedEventIds: z.array(z.string()),
    limitations: z.array(z.string().min(40)).min(1),
    evidence: z.array(evidenceRef.extend({
      id: z.string(),
      locator: z.string().min(15),
    })).min(1),
    reviewedBy: z.string(),
    reviewedAt: z.coerce.date(),
    publicationState: z.literal('published'),
    isFixture: z.literal(false),
    publishable: z.literal(true),
  }),
});

const industries = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/industries' }),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    commodityInputs: z.array(z.string()).min(1),
    transmissionMechanisms: z.array(z.string()).min(1),
    evidence: z.array(evidenceRef).min(1),
    reviewedBy: z.string(),
    reviewedAt: z.coerce.date(),
  }),
});

const authors = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/authors' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    bio: z.string().min(60),
    expertise: z.array(z.string()).min(1),
    disclosures: z.array(z.string()),
    profileUrl: z.string().url().optional(),
  }),
});

export const collections = {
  blog,
  commodities,
  events,
  companies,
  industries,
  authors,
};
