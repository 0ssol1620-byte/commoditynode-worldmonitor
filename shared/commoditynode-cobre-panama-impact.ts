import {
  COMMODITY_ONTOLOGY_VERSION,
  type CommodityImpactEvent,
  type GraphSnapshot,
} from './commodity-impact-ontology';

const REVIEWER = 'CommodityNode Editorial';
const REVIEWED_AT = '2026-07-28T00:00:00.000Z';

export const COBRE_PANAMA_IMPACT_EVENT: CommodityImpactEvent = {
  id: 'event-cobre-panama-halt-2023',
  name: 'Cobre Panama production halt',
  occurredAt: '2023-11-28T00:00:00.000Z',
  locationEntityIds: ['region-colon-panama', 'country-panama'],
  affectedEntityIds: ['mine-cobre-panama'],
  materiality: 'material',
  materialityRationale:
    'A producing mine and its dedicated export route left normal operation. The reviewed record supports a supply interruption, not a standalone copper-price attribution.',
  evidenceIds: [
    'evidence-panama-court-law-406',
    'evidence-fqm-2023-production',
    'evidence-panama-mef-2024',
  ],
  status: 'published',
  isFixture: false,
};

export const COBRE_PANAMA_TIMELINE = [
  {
    date: '2023-11-27',
    label: 'Supreme Court decision declares Law 406 unconstitutional.',
    evidenceIds: ['evidence-panama-court-law-406'],
  },
  {
    date: '2023-11-28',
    label: 'The Judicial Branch publicly announces the unanimous decision.',
    evidenceIds: ['evidence-panama-court-law-406'],
  },
  {
    date: '2024-01-15',
    label: 'First Quantum reports the ramp-down, suspended guidance, and unsold concentrate.',
    evidenceIds: ['evidence-fqm-2023-production'],
  },
  {
    date: '2025-05-01',
    label: 'Panama’s 2024 report records no copper extraction or export for the year.',
    evidenceIds: ['evidence-panama-mef-2024'],
  },
] as const;

export const COBRE_PANAMA_PLAYBACK_SNAPSHOTS = COBRE_PANAMA_TIMELINE.map(
  (entry, index) => ({
    id: `cobre-panama-playback-${index + 1}`,
    date: entry.date,
    label: entry.label,
    evidenceIds: [
      ...new Set(
        COBRE_PANAMA_TIMELINE.slice(0, index + 1).flatMap((item) => [
          ...item.evidenceIds,
        ]),
      ),
    ],
    reconstruction: true as const,
  }),
);

export const COBRE_PANAMA_GRAPH_SNAPSHOT: GraphSnapshot = {
  id: 'graph-cobre-panama-2026-07-28',
  ontologyVersion: COMMODITY_ONTOLOGY_VERSION,
  createdAt: REVIEWED_AT,
  rootEntityId: 'mine-cobre-panama',
  eventId: COBRE_PANAMA_IMPACT_EVENT.id,
  entities: [
    {
      id: 'mine-cobre-panama',
      type: 'Mine',
      name: 'Cobre Panama',
      aliases: ['Cobre Panamá', 'Minera Panamá', 'Minera Panama', 'Cobre Panama mine'],
      description: 'Large copper mine in Donoso, Colón Province, Panama.',
    },
    {
      id: 'port-punta-rincon',
      type: 'Port',
      name: 'Punta Rincón port',
      aliases: ['Punta Rincon', 'Punta Rincón', 'Punta Rincon port'],
      description: 'Dedicated concentrate export facility associated with Cobre Panama.',
    },
    {
      id: 'commodity-copper',
      type: 'Commodity',
      name: 'Copper',
      aliases: ['Cu', 'Copper supply', 'Copper concentrate'],
    },
    {
      id: 'company-first-quantum',
      type: 'Company',
      name: 'First Quantum Minerals',
      aliases: ['First Quantum', 'FQM', 'First Quantum Minerals Ltd.'],
    },
    {
      id: 'industry-copper-consuming',
      type: 'Industry',
      name: 'Copper-consuming industries',
      aliases: ['Electrification supply chain', 'Electrical equipment industry'],
      description:
        'Illustrative downstream demand group; pass-through depends on inventories, substitution, other supply, and demand.',
    },
    {
      id: 'country-panama',
      type: 'Country',
      name: 'Panama',
      aliases: ['Republic of Panama', 'Panamá'],
    },
    {
      id: 'region-colon-panama',
      type: 'Region',
      name: 'Colón Province',
      aliases: ['Colon Province', 'Colón', 'Colon, Panama'],
    },
    {
      id: 'event-cobre-panama-halt-2023',
      type: 'Event',
      name: 'Cobre Panama production halt',
      aliases: ['Cobre Panama halt', '2023 Cobre Panama shutdown'],
    },
    {
      id: 'source-panama-court',
      type: 'Source',
      name: 'Judicial Branch of Panama',
      aliases: ['Órgano Judicial de Panamá', 'Panama Supreme Court'],
    },
    {
      id: 'source-first-quantum',
      type: 'Source',
      name: 'First Quantum Minerals',
      aliases: ['FQM'],
    },
    {
      id: 'source-panama-mef',
      type: 'Source',
      name: 'Ministry of Economy and Finance of Panama',
      aliases: ['Panama MEF', 'MEF Panamá'],
    },
  ],
  evidence: [
    {
      id: 'evidence-panama-court-law-406',
      claimId: 'claim-court-ruling',
      sourceEntityId: 'source-panama-court',
      sourceUrl:
        'https://www.organojudicial.gob.pa/noticias/judiciales/CSJ-declara-inconstitucional-la-Ley-406-de-20-de-octubre-de-2023',
      sourceTitle: 'Supreme Court declares Law 406 unconstitutional',
      publisher: 'Judicial Branch of Panama',
      publishedAt: '2023-11-28T00:00:00.000Z',
      retrievedAt: REVIEWED_AT,
      locator: 'Announcement dated 28 November 2023; decision issued 27 November 2023.',
      evidenceType: 'official_primary',
      supports: true,
    },
    {
      id: 'evidence-fqm-2023-production',
      claimId: 'claim-production-and-port-halt',
      sourceEntityId: 'source-first-quantum',
      sourceUrl:
        'https://www.first-quantum.com/news/first-quantum-minerals-announces-2023-preliminary-production-2024-2026-guidance-and-balance-sheet-initiatives/',
      sourceTitle: '2023 preliminary production and 2024–2026 guidance',
      publisher: 'First Quantum Minerals',
      publishedAt: '2024-01-15T00:00:00.000Z',
      retrievedAt: REVIEWED_AT,
      locator:
        'Cobre Panama section: November ramp-down, preservation and safe-management, suspended guidance, and unsold concentrate.',
      evidenceType: 'company_primary',
      supports: true,
    },
    {
      id: 'evidence-panama-mef-2024',
      claimId: 'claim-no-2024-extraction-or-export',
      sourceEntityId: 'source-panama-mef',
      sourceUrl:
        'https://www.mef.gob.pa/wp-content/uploads/2025/05/MEF-DAES.-Informe-Economico-y-Social-2024.pdf',
      sourceTitle: 'Panama Economic and Social Report 2024',
      publisher: 'Ministry of Economy and Finance of Panama',
      publishedAt: '2025-05-01T00:00:00.000Z',
      retrievedAt: REVIEWED_AT,
      locator:
        'Mining and quarrying section, page 27: no copper extraction or exports recorded in 2024.',
      evidenceType: 'official_primary',
      supports: true,
    },
  ],
  edges: [
    {
      id: 'edge-cobre-produces-copper',
      sourceEntityId: 'mine-cobre-panama',
      targetEntityId: 'commodity-copper',
      relationType: 'produces',
      direction: 'negative',
      directness: 'direct',
      strengthBand: 'high',
      confidenceBand: 'strong',
      lagMinDays: 0,
      lagMaxDays: 30,
      invalidation:
        'Supersede when reviewed evidence confirms a return to sustained commercial production.',
      claimIds: ['claim-production-and-port-halt', 'claim-no-2024-extraction-or-export'],
      evidenceIds: ['evidence-fqm-2023-production', 'evidence-panama-mef-2024'],
      validFrom: '2023-11-01T00:00:00.000Z',
      status: 'published',
      reviewedBy: REVIEWER,
      reviewedAt: REVIEWED_AT,
      publishedAt: REVIEWED_AT,
    },
    {
      id: 'edge-cobre-ships-punta-rincon',
      sourceEntityId: 'mine-cobre-panama',
      targetEntityId: 'port-punta-rincon',
      relationType: 'ships_through',
      direction: 'negative',
      directness: 'direct',
      strengthBand: 'high',
      confidenceBand: 'strong',
      lagMinDays: 0,
      lagMaxDays: 14,
      invalidation:
        'Supersede when port operations and concentrate shipments resume under reviewed evidence.',
      claimIds: ['claim-production-and-port-halt'],
      evidenceIds: ['evidence-fqm-2023-production'],
      validFrom: '2023-11-01T00:00:00.000Z',
      status: 'published',
      reviewedBy: REVIEWER,
      reviewedAt: REVIEWED_AT,
      publishedAt: REVIEWED_AT,
    },
    {
      id: 'edge-copper-supplies-industry',
      sourceEntityId: 'commodity-copper',
      targetEntityId: 'industry-copper-consuming',
      relationType: 'supplies',
      direction: 'conditional',
      directness: 'indirect',
      strengthBand: 'medium',
      confidenceBand: 'moderate',
      lagMinDays: 30,
      lagMaxDays: 180,
      condition:
        'Downstream effects require the supply loss to remain material after inventories, substitution, other mine supply, and demand are considered.',
      invalidation:
        'Invalidate this path when inventories or replacement supply absorb the interruption without a measurable downstream constraint.',
      claimIds: ['claim-production-and-port-halt', 'claim-no-2024-extraction-or-export'],
      evidenceIds: ['evidence-fqm-2023-production', 'evidence-panama-mef-2024'],
      validFrom: '2023-11-01T00:00:00.000Z',
      status: 'published',
      reviewedBy: REVIEWER,
      reviewedAt: REVIEWED_AT,
      publishedAt: REVIEWED_AT,
    },
    {
      id: 'edge-fqm-operates-cobre',
      sourceEntityId: 'company-first-quantum',
      targetEntityId: 'mine-cobre-panama',
      relationType: 'operates',
      direction: 'negative',
      directness: 'direct',
      strengthBand: 'high',
      confidenceBand: 'strong',
      claimIds: ['claim-production-and-port-halt'],
      evidenceIds: ['evidence-fqm-2023-production'],
      invalidation:
        'Supersede if reviewed corporate or government records identify a different operator.',
      validFrom: '2023-11-01T00:00:00.000Z',
      status: 'published',
      reviewedBy: REVIEWER,
      reviewedAt: REVIEWED_AT,
      publishedAt: REVIEWED_AT,
    },
    {
      id: 'edge-cobre-located-colon',
      sourceEntityId: 'mine-cobre-panama',
      targetEntityId: 'region-colon-panama',
      relationType: 'located_in',
      direction: 'mixed',
      directness: 'direct',
      strengthBand: 'high',
      confidenceBand: 'strong',
      claimIds: ['claim-court-ruling'],
      evidenceIds: ['evidence-panama-court-law-406'],
      invalidation:
        'Supersede if an authoritative geographic record corrects the asset location.',
      status: 'published',
      reviewedBy: REVIEWER,
      reviewedAt: REVIEWED_AT,
      publishedAt: REVIEWED_AT,
    },
    {
      id: 'edge-colon-located-panama',
      sourceEntityId: 'region-colon-panama',
      targetEntityId: 'country-panama',
      relationType: 'located_in',
      direction: 'mixed',
      directness: 'direct',
      strengthBand: 'high',
      confidenceBand: 'strong',
      claimIds: ['claim-court-ruling'],
      evidenceIds: ['evidence-panama-court-law-406'],
      invalidation:
        'Supersede if an authoritative geographic record changes the jurisdiction.',
      status: 'published',
      reviewedBy: REVIEWER,
      reviewedAt: REVIEWED_AT,
      publishedAt: REVIEWED_AT,
    },
  ],
};
