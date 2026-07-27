export const COMMODITYNODE_EVENT_TYPES = [
  'operations_halt',
  'production_change',
  'transport_disruption',
  'trade_restriction',
  'policy_change',
  'weather_disruption',
  'inventory_change',
  'demand_change',
] as const;

export const COMMODITYNODE_EVENT_DIRECTIONS = [
  'supply_negative',
  'supply_positive',
  'demand_negative',
  'demand_positive',
  'mixed',
  'uncertain',
] as const;

export const COMMODITYNODE_EVENT_MATERIALITY = [
  'minor',
  'notable',
  'material',
  'critical',
] as const;

export type CommodityNodeEventType = (typeof COMMODITYNODE_EVENT_TYPES)[number];
export type CommodityNodeEventDirection = (typeof COMMODITYNODE_EVENT_DIRECTIONS)[number];
export type CommodityNodeEventMateriality =
  (typeof COMMODITYNODE_EVENT_MATERIALITY)[number];

export interface CommodityNodeEventExtractionCandidate {
  commodityIds: readonly string[];
  entityIds: readonly string[];
  location: {
    id: string;
    label: string;
    countryCode: string;
    latitude: number;
    longitude: number;
  };
  eventType: CommodityNodeEventType;
  direction: CommodityNodeEventDirection;
  materiality: CommodityNodeEventMateriality;
}

const STABLE_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireStableIds(value: unknown, field: string): readonly string[] {
  if (
    !Array.isArray(value)
    || value.length === 0
    || !value.every((item) => typeof item === 'string' && STABLE_ID.test(item))
  ) {
    throw new Error(`[commoditynode-event-extraction] ${field} requires stable ids`);
  }
  return [...new Set(value)].sort();
}

function requireEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new Error(`[commoditynode-event-extraction] ${field} is outside the closed schema`);
  }
  return value as T;
}

function parseLocation(value: unknown): CommodityNodeEventExtractionCandidate['location'] {
  if (!isRecord(value)) {
    throw new Error('[commoditynode-event-extraction] location is required');
  }
  const id = value.id;
  const label = value.label;
  const countryCode = value.countryCode;
  const latitude = value.latitude;
  const longitude = value.longitude;
  if (typeof id !== 'string' || !STABLE_ID.test(id)) {
    throw new Error('[commoditynode-event-extraction] location.id is invalid');
  }
  if (typeof label !== 'string' || label.trim().length < 3) {
    throw new Error('[commoditynode-event-extraction] location.label is invalid');
  }
  if (typeof countryCode !== 'string' || !/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error('[commoditynode-event-extraction] location.countryCode is invalid');
  }
  if (
    typeof latitude !== 'number'
    || !Number.isFinite(latitude)
    || latitude < -90
    || latitude > 90
    || typeof longitude !== 'number'
    || !Number.isFinite(longitude)
    || longitude < -180
    || longitude > 180
  ) {
    throw new Error('[commoditynode-event-extraction] location coordinates are invalid');
  }
  return {
    id,
    label: label.trim(),
    countryCode,
    latitude,
    longitude,
  };
}

/**
 * Fail-closed boundary for machine or rules-based extraction. Extra narrative
 * fields may exist upstream, but these six dimensions must validate before a
 * record can enter the private editorial queue.
 */
export function parseCommodityNodeEventExtraction(
  value: unknown,
): CommodityNodeEventExtractionCandidate {
  if (!isRecord(value)) {
    throw new Error('[commoditynode-event-extraction] candidate must be an object');
  }
  return {
    commodityIds: requireStableIds(value.commodityIds, 'commodityIds'),
    entityIds: requireStableIds(value.entityIds, 'entityIds'),
    location: parseLocation(value.location),
    eventType: requireEnum(value.eventType, COMMODITYNODE_EVENT_TYPES, 'eventType'),
    direction: requireEnum(value.direction, COMMODITYNODE_EVENT_DIRECTIONS, 'direction'),
    materiality: requireEnum(
      value.materiality,
      COMMODITYNODE_EVENT_MATERIALITY,
      'materiality',
    ),
  };
}
