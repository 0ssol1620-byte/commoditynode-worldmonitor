import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

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
    summary: z.string(),
    occurredAt: z.coerce.date(),
    expiresAt: z.coerce.date().optional(),
    commodityIds: z.array(z.string()).min(1),
    location: z.string(),
    materiality: z.enum(['minor', 'notable', 'material', 'critical']),
    status: z.enum(['candidate', 'reviewed', 'published', 'expired', 'rejected']),
    isFixture: z.boolean().default(false),
    evidence: z.array(evidenceRef),
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
    description: z.string(),
    commodityIds: z.array(z.string()).min(1),
    exposureType: z.enum(['producer', 'processor', 'transporter', 'consumer', 'diversified']),
    evidence: z.array(evidenceRef).min(1),
    reviewedBy: z.string(),
    reviewedAt: z.coerce.date(),
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
