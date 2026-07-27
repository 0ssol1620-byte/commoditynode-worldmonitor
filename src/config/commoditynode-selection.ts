import {
  COMMODITY_PORTS,
  MINING_SITES,
  PROCESSING_PLANTS,
  type CommodityPort,
  type MineSite,
  type ProcessingPlant,
} from './commodity-geo';
import { COMMODITY_MINERS, type CommodityMiner } from './commodity-miners';
import {
  COMMODITY_GROUP_LABELS,
  COMMODITY_UNIVERSE_NODES,
  getCommodityUniverseNodeIdForLabel,
  type CommodityUniverseNode,
} from './commoditynode-universe';
import {
  TRADE_ROUTES,
  resolveTradeRouteSegments,
  type TradeRoute,
} from './trade-routes';
import {
  COBRE_PANAMA_GRAPH_SNAPSHOT,
  COBRE_PANAMA_IMPACT_EVENT,
} from '../../shared/commoditynode-cobre-panama-impact';
import type { MapLayers } from '@/types';

export type CommodityNodeSelectionKind =
  | 'commodity'
  | 'mine'
  | 'processing_plant'
  | 'commodity_port'
  | 'company'
  | 'event'
  | 'route';

export type CommodityNodeSelectionSourceStatus =
  | 'commodity_model'
  | 'reviewed_registry'
  | 'verified_historical_event';

export interface CommodityNodeSelection {
  kind: CommodityNodeSelectionKind;
  entityId: string;
  entityName: string;
  typeLabel: string;
  subtitle: string;
  description: string;
  statusLabel: string;
  sourceStatus: CommodityNodeSelectionSourceStatus;
  sourceLabel: string;
  commodityId: string | null;
  commodityLabel: string | null;
  layerId: keyof MapLayers | null;
  latitude: number | null;
  longitude: number | null;
  researchHref: string;
  researchLabel: string;
  eventHref: string | null;
  eventLabel: string | null;
}

export type CommodityNodeSearchCategory =
  | 'commodity'
  | 'commodityfacility'
  | 'commoditycompany'
  | 'commodityevent'
  | 'commodityroute';

export interface CommodityNodeSearchItem {
  id: string;
  title: string;
  subtitle: string;
  data: CommodityNodeSelection;
}

export type CommodityNodeSearchCatalog = Record<
  CommodityNodeSearchCategory,
  CommodityNodeSearchItem[]
>;

const PUBLISHED_COMMODITY_SLUGS: Readonly<Record<string, string>> = {
  copper: 'copper',
  wti: 'crude-oil',
  gold: 'gold',
  cocoa: 'cocoa',
};

const FACILITY_LAYER_BY_KIND: Readonly<
  Record<'mine' | 'processing_plant' | 'commodity_port', keyof MapLayers>
> = {
  mine: 'miningSites',
  processing_plant: 'processingPlants',
  commodity_port: 'commodityPorts',
};

const FACILITY_PREFIX_BY_LAYER_ID: Readonly<Record<string, string>> = {
  'mining-sites-layer': 'mine:',
  miningSites: 'mine:',
  'processing-plants-layer': 'processing-plant:',
  processingPlants: 'processing-plant:',
  'commodity-ports-layer': 'commodity-port:',
  commodityPorts: 'commodity-port:',
};

function commodityResearchLink(
  commodityId: string | null,
): Pick<CommodityNodeSelection, 'researchHref' | 'researchLabel'> {
  const slug = commodityId ? PUBLISHED_COMMODITY_SLUGS[commodityId] : null;
  return slug
    ? {
        researchHref: `/commodities/${slug}/`,
        researchLabel: 'Open commodity research',
      }
    : {
        researchHref: '/commodities/',
        researchLabel: 'Browse commodity research',
      };
}

function normalizeCommodity(
  label: string | null | undefined,
): { commodityId: string | null; commodityLabel: string | null } {
  const commodityId = getCommodityUniverseNodeIdForLabel(label);
  const node = commodityId
    ? COMMODITY_UNIVERSE_NODES.find((candidate) => candidate.id === commodityId)
    : undefined;
  return {
    commodityId,
    commodityLabel: node?.name ?? label ?? null,
  };
}

function mineSelection(mine: MineSite): CommodityNodeSelection {
  const commodity = normalizeCommodity(mine.mineral);
  return {
    kind: 'mine',
    entityId: `mine:${mine.id}`,
    entityName: mine.name,
    typeLabel: 'Mine',
    subtitle: `${mine.mineral} · ${mine.country}`,
    description: mine.significance,
    statusLabel: mine.status.replace(/-/g, ' '),
    sourceStatus: 'reviewed_registry',
    sourceLabel: 'Reviewed facility registry · not live telemetry',
    ...commodity,
    layerId: FACILITY_LAYER_BY_KIND.mine,
    latitude: mine.lat,
    longitude: mine.lon,
    ...commodityResearchLink(commodity.commodityId),
    eventHref:
      mine.id === 'cobre-panama' ? '/events/cobre-panama-production-halt/' : null,
    eventLabel: mine.id === 'cobre-panama' ? 'Open verified Event Pulse' : null,
  };
}

function plantSelection(plant: ProcessingPlant): CommodityNodeSelection {
  const commodity = normalizeCommodity(plant.mineral);
  return {
    kind: 'processing_plant',
    entityId: `processing-plant:${plant.id}`,
    entityName: plant.name,
    typeLabel: 'Processing facility',
    subtitle: `${plant.mineral} · ${plant.country}`,
    description: plant.significance,
    statusLabel: plant.status.replace(/-/g, ' '),
    sourceStatus: 'reviewed_registry',
    sourceLabel: 'Reviewed facility registry · not live telemetry',
    ...commodity,
    layerId: FACILITY_LAYER_BY_KIND.processing_plant,
    latitude: plant.lat,
    longitude: plant.lon,
    ...commodityResearchLink(commodity.commodityId),
    eventHref: null,
    eventLabel: null,
  };
}

function portSelection(port: CommodityPort): CommodityNodeSelection {
  const primaryCommodity = port.commodities[0] ?? null;
  const commodity = normalizeCommodity(primaryCommodity);
  return {
    kind: 'commodity_port',
    entityId: `commodity-port:${port.id}`,
    entityName: port.name,
    typeLabel: 'Commodity port',
    subtitle: `${port.city}, ${port.country}`,
    description: port.significance,
    statusLabel: 'reference location',
    sourceStatus: 'reviewed_registry',
    sourceLabel: 'Reviewed facility registry · not live telemetry',
    ...commodity,
    layerId: FACILITY_LAYER_BY_KIND.commodity_port,
    latitude: port.lat,
    longitude: port.lon,
    ...commodityResearchLink(commodity.commodityId),
    eventHref: null,
    eventLabel: null,
  };
}

function commoditySelection(node: CommodityUniverseNode): CommodityNodeSelection {
  return {
    kind: 'commodity',
    entityId: `commodity:${node.id}`,
    entityName: node.name,
    typeLabel: 'Commodity',
    subtitle: `${COMMODITY_GROUP_LABELS[node.group]} · ${node.symbol}`,
    description: `${node.coverageNote}. Relationships represent analytical groupings, not price forecasts.`,
    statusLabel: 'relationship model',
    sourceStatus: 'commodity_model',
    sourceLabel: 'CommodityNode relationship taxonomy',
    commodityId: node.id,
    commodityLabel: node.name,
    layerId: null,
    latitude: null,
    longitude: null,
    ...commodityResearchLink(node.id),
    eventHref: node.id === 'copper' ? '/events/cobre-panama-production-halt/' : null,
    eventLabel: node.id === 'copper' ? 'Open Copper Event Pulse' : null,
  };
}

function companySelection(company: CommodityMiner): CommodityNodeSelection {
  const primaryLabel =
    company.sector === 'Diversified' ? company.mineralTypes[0] : company.sector;
  const commodity = normalizeCommodity(primaryLabel);
  return {
    kind: 'company',
    entityId: `company:${company.id}`,
    entityName: company.name,
    typeLabel: 'Company',
    subtitle: `${company.city}, ${company.country}`,
    description:
      company.description
      ?? `Reviewed company location associated with ${company.mineralTypes.join(', ')}.`,
    statusLabel: company.status.replace(/-/g, ' '),
    sourceStatus: 'reviewed_registry',
    sourceLabel: 'Reviewed company registry · not live market data',
    ...commodity,
    layerId: null,
    latitude: company.lat,
    longitude: company.lon,
    ...commodityResearchLink(commodity.commodityId),
    eventHref: null,
    eventLabel: null,
  };
}

function firstQuantumSelection(): CommodityNodeSelection {
  const mine = MINING_SITES.find((candidate) => candidate.id === 'cobre-panama');
  const graphCompany = COBRE_PANAMA_GRAPH_SNAPSHOT.entities.find(
    (entity) => entity.id === 'company-first-quantum',
  );
  const commodity = normalizeCommodity('Copper');
  return {
    kind: 'company',
    entityId: 'company:first-quantum-minerals',
    entityName: graphCompany?.name ?? 'First Quantum Minerals',
    typeLabel: 'Company',
    subtitle: 'Evidence-linked operator · Cobre Panama',
    description:
      'Operator connected to the reviewed Cobre Panama historical impact case. This record does not assert current operating status.',
    statusLabel: 'evidence linked',
    sourceStatus: 'verified_historical_event',
    sourceLabel: 'Verified historical evidence · reviewed 2026-07-28',
    ...commodity,
    layerId: 'miningSites',
    latitude: mine?.lat ?? null,
    longitude: mine?.lon ?? null,
    ...commodityResearchLink(commodity.commodityId),
    eventHref: '/events/cobre-panama-production-halt/',
    eventLabel: 'Open verified Event Pulse',
  };
}

function eventSelection(): CommodityNodeSelection {
  const mine = MINING_SITES.find((candidate) => candidate.id === 'cobre-panama');
  const commodity = normalizeCommodity('Copper');
  return {
    kind: 'event',
    entityId: `event:${COBRE_PANAMA_IMPACT_EVENT.id}`,
    entityName: COBRE_PANAMA_IMPACT_EVENT.name,
    typeLabel: 'Verified event',
    subtitle: '28 November 2023 · Panama',
    description: COBRE_PANAMA_IMPACT_EVENT.materialityRationale,
    statusLabel: 'published historical record',
    sourceStatus: 'verified_historical_event',
    sourceLabel: 'Three reviewed primary-source evidence records',
    ...commodity,
    layerId: 'commodityEvents',
    latitude: mine?.lat ?? null,
    longitude: mine?.lon ?? null,
    ...commodityResearchLink(commodity.commodityId),
    eventHref: '/events/cobre-panama-production-halt/',
    eventLabel: 'Open complete Event Pulse',
  };
}

function routeSelection(route: TradeRoute): CommodityNodeSelection {
  const segments = resolveTradeRouteSegments().filter(
    (segment) => segment.routeId === route.id,
  );
  const first = segments[0];
  const last = segments[segments.length - 1];
  const coordinates =
    first && last
      ? {
          latitude: (first.sourcePosition[1] + last.targetPosition[1]) / 2,
          longitude: (first.sourcePosition[0] + last.targetPosition[0]) / 2,
        }
      : { latitude: null, longitude: null };
  const commodity = route.category === 'energy'
    ? normalizeCommodity('Crude oil')
    : { commodityId: null, commodityLabel: null };
  return {
    kind: 'route',
    entityId: `route:${route.id}`,
    entityName: route.name,
    typeLabel: 'Trade route',
    subtitle: `${route.category} · ${route.from} to ${route.to}`,
    description: `${route.volumeDesc}. Route geometry is a reviewed reference corridor, not vessel tracking.`,
    statusLabel: route.status.replace(/_/g, ' '),
    sourceStatus: 'reviewed_registry',
    sourceLabel: 'Reviewed route registry · not live vessel telemetry',
    ...commodity,
    layerId: 'tradeRoutes',
    ...coordinates,
    ...commodityResearchLink(commodity.commodityId),
    eventHref: null,
    eventLabel: null,
  };
}

function toSearchItem(selection: CommodityNodeSelection): CommodityNodeSearchItem {
  return {
    id: selection.entityId,
    title: selection.entityName,
    subtitle: [
      selection.subtitle,
      selection.commodityLabel,
      selection.statusLabel,
    ]
      .filter(Boolean)
      .join(' · '),
    data: selection,
  };
}

let cachedCatalog: CommodityNodeSearchCatalog | null = null;
let cachedSelectionIndex: Map<string, CommodityNodeSelection> | null = null;

export function getCommodityNodeSearchCatalog(): CommodityNodeSearchCatalog {
  if (cachedCatalog) return cachedCatalog;

  const facilities = [
    ...MINING_SITES.map(mineSelection),
    ...PROCESSING_PLANTS.map(plantSelection),
    ...COMMODITY_PORTS.map(portSelection),
  ];
  const companies = [
    ...COMMODITY_MINERS.filter(
      (company) => company.siteType === 'headquarters',
    ).map(companySelection),
    firstQuantumSelection(),
  ];
  const catalog: CommodityNodeSearchCatalog = {
    commodity: COMMODITY_UNIVERSE_NODES.map(commoditySelection).map(toSearchItem),
    commodityfacility: facilities.map(toSearchItem),
    commoditycompany: companies.map(toSearchItem),
    commodityevent: [toSearchItem(eventSelection())],
    commodityroute: TRADE_ROUTES.map(routeSelection).map(toSearchItem),
  };
  cachedCatalog = catalog;
  cachedSelectionIndex = new Map(
    Object.values(catalog)
      .flat()
      .map((item) => [item.data.entityId, item.data]),
  );
  return catalog;
}

export function resolveCommodityNodeSelection(
  entityId: string | null | undefined,
  layerId?: string | null,
): CommodityNodeSelection | null {
  if (!entityId) return null;
  getCommodityNodeSearchCatalog();
  const direct = cachedSelectionIndex?.get(entityId);
  if (direct) return direct;

  const prefixedId = layerId
    ? `${FACILITY_PREFIX_BY_LAYER_ID[layerId] ?? ''}${entityId}`
    : entityId;
  const prefixed = cachedSelectionIndex?.get(prefixedId);
  if (prefixed) return prefixed;

  for (const prefix of [
    'mine:',
    'processing-plant:',
    'commodity-port:',
    'company:',
    'event:',
    'route:',
    'commodity:',
  ]) {
    const match = cachedSelectionIndex?.get(`${prefix}${entityId}`);
    if (match) return match;
  }
  return null;
}

export function isCommodityNodeSelection(
  value: unknown,
): value is CommodityNodeSelection {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CommodityNodeSelection>;
  return (
    typeof candidate.entityId === 'string'
    && typeof candidate.entityName === 'string'
    && typeof candidate.kind === 'string'
    && typeof candidate.researchHref === 'string'
  );
}
