export interface CanonicalCommodityNodeAlertEvent {
  fingerprint: string;
  eventId: string;
  eventType: "event_pulse" | "route";
  title: string;
  summary: string;
  evidenceHref: string;
  materiality: "notable" | "material" | "critical";
  publishedAt: number;
  scopes: ReadonlyArray<{
    scopeType: "event_pulse" | "route";
    scopeId: string;
  }>;
}

/**
 * Release-reviewed alert inputs only. Adding a row is a publication action:
 * the event must already have a crawlable evidence page and a stable fingerprint.
 * Runtime callers cannot supply titles, claims, materiality, or URLs.
 */
export const CANONICAL_COMMODITYNODE_ALERT_EVENTS:
  readonly CanonicalCommodityNodeAlertEvent[] = [
    {
      fingerprint: "cne_780ad836cbb5f9ef",
      eventId: "cobre-panama-production-halt",
      eventType: "event_pulse",
      title: "Cobre Panama production halted",
      summary:
        "Verified historical reconstruction of the mine shutdown and copper supply interruption.",
      evidenceHref:
        "https://commoditynode.com/events/cobre-panama-production-halt/",
      materiality: "material",
      publishedAt: Date.UTC(2023, 10, 28),
      scopes: [
        {
          scopeType: "event_pulse",
          scopeId: "cobre-panama-production-halt",
        },
      ],
    },
  ];
