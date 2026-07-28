import cobrePanamaSupplyPath from '../../public/images/events/cobre-panama-supply-path.asset.json';

export interface CommodityEventMediaVariant {
  format: 'avif' | 'webp' | 'jpeg';
  width: number;
  height: number;
  bytes: number;
  publicUrl: string;
}

export interface CommodityEventMediaRegistry {
  assetId: string;
  eventId: string;
  review: {
    disclosure: string;
    noActualSceneClaim: boolean;
    noReadableLogos: boolean;
    textFree: boolean;
  };
  rights: {
    status: string;
    publicDisplay: boolean;
  };
  variants: CommodityEventMediaVariant[];
  blurPlaceholder: string;
}

const EVENT_MEDIA = new Map<string, CommodityEventMediaRegistry>([
  [
    cobrePanamaSupplyPath.eventId,
    cobrePanamaSupplyPath as CommodityEventMediaRegistry,
  ],
]);

export function getCommodityEventMedia(eventId: string): CommodityEventMediaRegistry | undefined {
  const media = EVENT_MEDIA.get(eventId);
  if (!media?.rights.publicDisplay || !media.review.textFree || !media.review.noActualSceneClaim) {
    return undefined;
  }
  return media;
}

export function commodityEventMediaSrcset(
  media: CommodityEventMediaRegistry,
  format: CommodityEventMediaVariant['format'],
): string {
  return media.variants
    .filter((variant) => variant.format === format)
    .sort((left, right) => left.width - right.width)
    .map((variant) => `${variant.publicUrl} ${variant.width}w`)
    .join(', ');
}
