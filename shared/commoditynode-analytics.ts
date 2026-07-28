export const COMMODITYNODE_ANALYTICS_SCHEMA_VERSION = 1;

export const COMMODITYNODE_ANALYTICS_EVENTS = [
  'page_view',
  'research_opened',
  'live_opened',
  'evidence_opened',
  'impact_path_opened',
  'newsletter_signup_started',
  'newsletter_signup_submitted',
  'custom_brief_started',
  'custom_brief_submitted',
  'watchlist_item_saved',
  'watchlist_item_removed',
  'alert_created',
  'pro_interest_opened',
  'checkout_started',
  'checkout_completed',
  'api_docs_opened',
  'api_key_created',
] as const;

export type CommodityNodeAnalyticsEvent = (typeof COMMODITYNODE_ANALYTICS_EVENTS)[number];
export type CommodityNodeAnalyticsSurface = 'research' | 'live' | 'api';

export interface CommodityNodeAnalyticsPayload {
  version: typeof COMMODITYNODE_ANALYTICS_SCHEMA_VERSION;
  event: CommodityNodeAnalyticsEvent;
  surface: CommodityNodeAnalyticsSurface;
  routeType: string;
  placement?: string;
  entityType?: 'commodity' | 'company' | 'event' | 'route' | 'benchmark';
  conversion?: 'newsletter' | 'custom_brief' | 'pro' | 'api';
}

const EVENT_SET = new Set<string>(COMMODITYNODE_ANALYTICS_EVENTS);
const TOKEN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function optionalToken(value: unknown): string | undefined {
  return typeof value === 'string' && TOKEN.test(value) ? value : undefined;
}

export function parseCommodityNodeAnalyticsPayload(
  value: unknown,
): CommodityNodeAnalyticsPayload | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  if (payload.version !== COMMODITYNODE_ANALYTICS_SCHEMA_VERSION) return null;
  if (typeof payload.event !== 'string' || !EVENT_SET.has(payload.event)) return null;
  if (payload.surface !== 'research' && payload.surface !== 'live' && payload.surface !== 'api') {
    return null;
  }
  if (typeof payload.routeType !== 'string' || !TOKEN.test(payload.routeType)) return null;

  const placement = optionalToken(payload.placement);
  if (payload.placement !== undefined && placement === undefined) return null;
  const entityType = optionalToken(payload.entityType);
  if (
    payload.entityType !== undefined
    && !['commodity', 'company', 'event', 'route', 'benchmark'].includes(entityType ?? '')
  ) return null;
  const conversion = optionalToken(payload.conversion);
  if (
    payload.conversion !== undefined
    && !['newsletter', 'custom_brief', 'pro', 'api'].includes(conversion ?? '')
  ) return null;

  return {
    version: COMMODITYNODE_ANALYTICS_SCHEMA_VERSION,
    event: payload.event as CommodityNodeAnalyticsEvent,
    surface: payload.surface,
    routeType: payload.routeType,
    ...(placement ? { placement } : {}),
    ...(entityType ? {
      entityType: entityType as CommodityNodeAnalyticsPayload['entityType'],
    } : {}),
    ...(conversion ? {
      conversion: conversion as CommodityNodeAnalyticsPayload['conversion'],
    } : {}),
  };
}

export function commodityNodeAnalyticsAggregateKey(
  payload: CommodityNodeAnalyticsPayload,
  day: string,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid analytics day');
  return [
    'commoditynode',
    'analytics',
    `v${payload.version}`,
    day,
    payload.surface,
    payload.event,
    payload.routeType,
    payload.placement ?? 'none',
    payload.entityType ?? 'none',
    payload.conversion ?? 'none',
  ].join(':');
}

