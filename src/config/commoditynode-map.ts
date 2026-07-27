import type { CommodityPort, MineSite, ProcessingPlant } from './commodity-geo';
import type { MapLayers } from '@/types';

export type CommodityNodeMapEntity =
  | {
      kind: 'mine';
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      commodity: string;
      operator: string;
      operatingStatus: MineSite['status'];
      sourceStatus: 'reviewed_registry';
    }
  | {
      kind: 'processing_plant';
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      commodity: string;
      operator: string;
      operatingStatus: ProcessingPlant['status'];
      sourceStatus: 'reviewed_registry';
    }
  | {
      kind: 'commodity_port';
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      commodities: readonly string[];
      operatingStatus: 'reference_location';
      sourceStatus: 'reviewed_registry';
    };

export function adaptMineToCommodityNodeEntity(mine: MineSite): CommodityNodeMapEntity {
  return {
    kind: 'mine',
    id: `mine:${mine.id}`,
    name: mine.name,
    latitude: mine.lat,
    longitude: mine.lon,
    commodity: mine.mineral,
    operator: mine.operator,
    operatingStatus: mine.status,
    sourceStatus: 'reviewed_registry',
  };
}

export function adaptPlantToCommodityNodeEntity(
  plant: ProcessingPlant,
): CommodityNodeMapEntity {
  return {
    kind: 'processing_plant',
    id: `processing-plant:${plant.id}`,
    name: plant.name,
    latitude: plant.lat,
    longitude: plant.lon,
    commodity: plant.mineral,
    operator: plant.operator,
    operatingStatus: plant.status,
    sourceStatus: 'reviewed_registry',
  };
}

export function adaptPortToCommodityNodeEntity(
  port: CommodityPort,
): CommodityNodeMapEntity {
  return {
    kind: 'commodity_port',
    id: `commodity-port:${port.id}`,
    name: port.name,
    latitude: port.lat,
    longitude: port.lon,
    commodities: port.commodities,
    operatingStatus: 'reference_location',
    sourceStatus: 'reviewed_registry',
  };
}

export const COMMODITYNODE_LAYER_GROUPS = [
  {
    id: 'production',
    label: 'Production assets',
    layers: ['miningSites', 'processingPlants', 'commodityPorts'],
  },
  {
    id: 'flows',
    label: 'Flows and routes',
    layers: ['pipelines', 'tradeRoutes', 'waterways'],
  },
  {
    id: 'context',
    label: 'Market and event context',
    layers: ['commodityEvents', 'commodityHubs', 'natural'],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  layers: readonly (keyof MapLayers)[];
}>;

export type CommodityNodeMapPresetId = 'copper' | 'crude-oil' | 'gold' | 'cocoa';

export interface CommodityNodeMapPreset {
  id: CommodityNodeMapPresetId;
  label: string;
  view: 'global' | 'mena' | 'latam' | 'africa';
  enabledLayers: readonly (keyof MapLayers)[];
  primaryCommodityId: 'copper' | 'wti' | 'gold' | 'cocoa';
}

export const COMMODITYNODE_MAP_PRESETS: readonly CommodityNodeMapPreset[] = [
  {
    id: 'copper',
    label: 'Copper',
    view: 'latam',
    enabledLayers: [
      'miningSites',
      'processingPlants',
      'commodityPorts',
      'commodityEvents',
      'tradeRoutes',
      'waterways',
    ],
    primaryCommodityId: 'copper',
  },
  {
    id: 'crude-oil',
    label: 'Crude oil',
    view: 'mena',
    enabledLayers: [
      'pipelines',
      'commodityPorts',
      'tradeRoutes',
      'waterways',
      'commodityHubs',
    ],
    primaryCommodityId: 'wti',
  },
  {
    id: 'gold',
    label: 'Gold',
    view: 'global',
    enabledLayers: [
      'miningSites',
      'processingPlants',
      'commodityPorts',
      'commodityHubs',
    ],
    primaryCommodityId: 'gold',
  },
  {
    id: 'cocoa',
    label: 'Cocoa',
    view: 'africa',
    enabledLayers: ['commodityPorts', 'tradeRoutes', 'waterways', 'commodityHubs'],
    primaryCommodityId: 'cocoa',
  },
] as const;

const COMMODITYNODE_PRESET_LAYER_KEYS = new Set<keyof MapLayers>(
  COMMODITYNODE_LAYER_GROUPS.flatMap((group) => [...group.layers]),
);

export function applyCommodityNodeMapPreset(
  current: MapLayers,
  presetId: CommodityNodeMapPresetId,
): { layers: MapLayers; preset: CommodityNodeMapPreset } {
  const preset =
    COMMODITYNODE_MAP_PRESETS.find((candidate) => candidate.id === presetId)
    ?? COMMODITYNODE_MAP_PRESETS[0];
  if (!preset) throw new Error('CommodityNode map presets are unavailable.');
  const enabled = new Set(preset.enabledLayers);
  const layers = { ...current };
  for (const key of COMMODITYNODE_PRESET_LAYER_KEYS) {
    layers[key] = enabled.has(key);
  }
  return { layers, preset };
}
