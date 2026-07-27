import type { MapLayers, PanelConfig } from '@/types';
import type { VariantConfig } from './base';

/**
 * CommodityNode is additive. The upstream `commodity` variant remains intact
 * as the merge/reference baseline.
 */
export const COMMODITYNODE_PANELS: Record<string, PanelConfig> = {
  map: { name: 'Commodity Impact Map', enabled: true, priority: 1 },
  'event-pulse': { name: 'Material Commodity Events', enabled: true, priority: 1 },
  commodities: { name: 'Benchmark & Proxy Tape', enabled: true, priority: 1 },
  'supply-chain': { name: 'Supply Chain & Shipping', enabled: true, priority: 1 },
  'route-risk': { name: 'Routes & Chokepoints', enabled: true, priority: 1 },
  'market-implications': { name: 'Evidence-backed Market Implications', enabled: true, priority: 1 },
  monitors: { name: 'My Monitors', enabled: true, priority: 2 },
};

export const COMMODITYNODE_MAP_LAYERS: MapLayers = {
  gpsJamming: false,
  satellites: false,
  conflicts: false,
  bases: false,
  cables: false,
  pipelines: true,
  storageFacilities: false,
  fuelShortages: false,
  hotspots: false,
  ais: false,
  liveTankers: false,
  nuclear: false,
  irradiators: false,
  radiationWatch: false,
  sanctions: false,
  weather: false,
  economic: false,
  waterways: true,
  outages: false,
  cyberThreats: false,
  datacenters: false,
  protests: false,
  flights: false,
  military: false,
  natural: true,
  spaceports: false,
  minerals: false,
  fires: false,
  ucdpEvents: false,
  displacement: false,
  climate: false,
  startupHubs: false,
  cloudRegions: false,
  accelerators: false,
  techHQs: false,
  techEvents: false,
  stockExchanges: false,
  financialCenters: false,
  centralBanks: false,
  commodityHubs: true,
  gulfInvestments: false,
  positiveEvents: false,
  kindness: false,
  happiness: false,
  speciesRecovery: false,
  renewableInstallations: false,
  tradeRoutes: true,
  iranAttacks: false,
  ciiChoropleth: false,
  resilienceScore: false,
  dayNight: false,
  miningSites: true,
  processingPlants: true,
  commodityPorts: true,
  webcams: false,
  diseaseOutbreaks: false,
};

/**
 * Mobile starts with decision-bearing points only. Routes, plants, AIS,
 * weather, fires, and sanctions remain available but opt-in.
 */
export const COMMODITYNODE_MOBILE_MAP_LAYERS: MapLayers = {
  ...COMMODITYNODE_MAP_LAYERS,
  pipelines: false,
  waterways: false,
  tradeRoutes: false,
  processingPlants: false,
  natural: true,
};

export const commoditynodeVariant: VariantConfig = {
  name: 'CommodityNode',
  description: 'Evidence-linked commodity markets, assets, routes, and material events.',
  panels: COMMODITYNODE_PANELS,
  mapLayers: COMMODITYNODE_MAP_LAYERS,
  mobileMapLayers: COMMODITYNODE_MOBILE_MAP_LAYERS,
};
