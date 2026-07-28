import { MINING_SITES } from './commodity-geo';
import { COBRE_PANAMA_IMPACT_EVENT } from '../../shared/commoditynode-cobre-panama-impact';

export interface CommodityNodeVerifiedMapEvent {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  occurredAt: string;
  commodityId: 'copper';
  commodityLabel: 'Copper';
  materiality: 'material';
  status: 'published';
  sourceStatus: 'verified_historical_event';
  evidenceCount: number;
  detailHref: string;
}

const cobrePanama = MINING_SITES.find((site) => site.id === 'cobre-panama');

if (!cobrePanama) {
  throw new Error('Cobre Panama coordinates are required for the verified event layer.');
}
if (
  COBRE_PANAMA_IMPACT_EVENT.materiality !== 'material'
  || COBRE_PANAMA_IMPACT_EVENT.status !== 'published'
) {
  throw new Error('Only published material events may enter the verified event layer.');
}

/**
 * Only reviewed, published events belong here. This is intentionally not a
 * breaking-news feed and must never imply live operational telemetry.
 */
export const COMMODITYNODE_VERIFIED_MAP_EVENTS: readonly CommodityNodeVerifiedMapEvent[] = [
  {
    id: COBRE_PANAMA_IMPACT_EVENT.id,
    name: COBRE_PANAMA_IMPACT_EVENT.name,
    latitude: cobrePanama.lat,
    longitude: cobrePanama.lon,
    occurredAt: COBRE_PANAMA_IMPACT_EVENT.occurredAt,
    commodityId: 'copper',
    commodityLabel: 'Copper',
    materiality: 'material',
    status: 'published',
    sourceStatus: 'verified_historical_event',
    evidenceCount: COBRE_PANAMA_IMPACT_EVENT.evidenceIds.length,
    detailHref: '/events/cobre-panama-production-halt/',
  },
] as const;

export const COMMODITY_EVENT_PULSE_CYCLE_MS = 1_200;
export const COMMODITY_EVENT_PULSE_CYCLES = 2;
export const COMMODITY_EVENT_PULSE_DURATION_MS =
  COMMODITY_EVENT_PULSE_CYCLE_MS * COMMODITY_EVENT_PULSE_CYCLES;

export interface CommodityEventPulseFrame {
  active: boolean;
  opacity: number;
  radiusScale: number;
}

/**
 * Produces a deterministic two-cycle ripple. Reduced-motion users and settled
 * events receive the same quiet static ring, so the layer remains legible
 * without permanent repaints or compositing work.
 */
export function getCommodityEventPulseFrame(
  nowMs: number,
  startedAtMs: number,
  reducedMotion: boolean,
): CommodityEventPulseFrame {
  if (reducedMotion) {
    return { active: false, opacity: 0.36, radiusScale: 1 };
  }

  const elapsed = Math.max(0, nowMs - startedAtMs);
  if (elapsed >= COMMODITY_EVENT_PULSE_DURATION_MS) {
    return { active: false, opacity: 0.28, radiusScale: 1 };
  }

  const phase = (elapsed % COMMODITY_EVENT_PULSE_CYCLE_MS)
    / COMMODITY_EVENT_PULSE_CYCLE_MS;
  return {
    active: true,
    opacity: 0.72 * (1 - phase),
    radiusScale: 0.82 + phase * 1.38,
  };
}
