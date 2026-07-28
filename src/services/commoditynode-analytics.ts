import {
  COMMODITYNODE_ANALYTICS_SCHEMA_VERSION,
  type CommodityNodeAnalyticsEvent,
  type CommodityNodeAnalyticsPayload,
} from '../../shared/commoditynode-analytics';
import {
  COMMODITYNODE_CONSENT_EVENT,
  COMMODITYNODE_CONSENT_STORAGE_KEY,
  parseCommodityNodeConsent,
} from '../../shared/commoditynode-privacy';

type AnalyticsProperties = Pick<
  CommodityNodeAnalyticsPayload,
  'routeType' | 'placement' | 'entityType' | 'conversion'
>;

function readCookie(name: string): string | null {
  const value = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value ? decodeURIComponent(value) : null;
}

function analyticsAllowed(): boolean {
  try {
    const consent = parseCommodityNodeConsent(
      localStorage.getItem(COMMODITYNODE_CONSENT_STORAGE_KEY)
      ?? readCookie(COMMODITYNODE_CONSENT_STORAGE_KEY),
    );
    return consent?.analytics === true;
  } catch {
    return false;
  }
}

export function trackCommodityNodeEvent(
  event: CommodityNodeAnalyticsEvent,
  properties: AnalyticsProperties = { routeType: 'live_application' },
): void {
  if (!analyticsAllowed()) return;
  const payload: CommodityNodeAnalyticsPayload = {
    version: COMMODITYNODE_ANALYTICS_SCHEMA_VERSION,
    event,
    surface: 'live',
    routeType: properties.routeType,
    ...(properties.placement ? { placement: properties.placement } : {}),
    ...(properties.entityType ? { entityType: properties.entityType } : {}),
    ...(properties.conversion ? { conversion: properties.conversion } : {}),
  };
  void fetch('https://commoditynode.com/api/commoditynode-analytics', {
    method: 'POST',
    credentials: 'omit',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export function initCommodityNodeAnalytics(): void {
  const pageView = () => trackCommodityNodeEvent('page_view');
  if (analyticsAllowed()) pageView();
  window.addEventListener(COMMODITYNODE_CONSENT_EVENT, pageView);
  window.addEventListener('commoditynode:analytics', (event) => {
    const detail = (event as CustomEvent<{
      event?: CommodityNodeAnalyticsEvent;
      properties?: AnalyticsProperties;
    }>).detail;
    if (detail?.event) trackCommodityNodeEvent(detail.event, detail.properties);
  });
}

