import type { CollectionEntry } from 'astro:content';
import { evaluateCommodityEventPublication } from '../../../shared/commoditynode-event-pulse';

export type CommodityEventEntry = CollectionEntry<'events'>;

export function commodityEventPublicationDecision(event: CommodityEventEntry) {
  return evaluateCommodityEventPublication({
    status: event.data.status,
    isFixture: event.data.isFixture,
    materiality: event.data.materiality,
    occurredAt: event.data.occurredAt,
    publishedAt: event.data.publishedAt,
    reviewedAt: event.data.reviewedAt,
    reviewedBy: event.data.reviewedBy,
    claims: event.data.claims,
    evidence: event.data.evidence,
    unknowns: event.data.unknowns,
  });
}

export function isPublishedCommodityEvent(event: CommodityEventEntry): boolean {
  return commodityEventPublicationDecision(event).publishable;
}

export function sortCommodityEventsByOccurrence(
  left: CommodityEventEntry,
  right: CommodityEventEntry,
): number {
  return right.data.occurredAt.valueOf() - left.data.occurredAt.valueOf();
}
