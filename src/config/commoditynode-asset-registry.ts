import {
  COMMODITY_PORTS,
  MINING_SITES,
  PROCESSING_PLANTS,
  type CommodityPort,
  type MineSite,
  type ProcessingPlant,
} from './commodity-geo';

export type CommodityNodeAssetKind = 'mine' | 'processing_plant' | 'commodity_port';

export interface CommodityNodeAssetCandidate {
  candidateId: string;
  upstreamId: string;
  kind: CommodityNodeAssetKind;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  commodities: readonly string[];
  operator: string | null;
  source: {
    datasetId: 'worldmonitor-commodity-geography';
    locator: 'src/config/commodity-geo.ts';
    importedFrom: 'upstream';
  };
  workflow: {
    status: 'candidate';
    visibility: 'private';
    importedAt: '2026-07-28T00:00:00.000Z';
    reviewedAt: null;
    reviewedBy: null;
  };
}

function candidateId(kind: CommodityNodeAssetKind, upstreamId: string): string {
  return `asset-candidate:${kind}:${upstreamId}`;
}

function mineCandidate(asset: MineSite): CommodityNodeAssetCandidate {
  return {
    candidateId: candidateId('mine', asset.id),
    upstreamId: asset.id,
    kind: 'mine',
    name: asset.name,
    latitude: asset.lat,
    longitude: asset.lon,
    country: asset.country,
    commodities: [asset.mineral],
    operator: asset.operator || null,
    source: {
      datasetId: 'worldmonitor-commodity-geography',
      locator: 'src/config/commodity-geo.ts',
      importedFrom: 'upstream',
    },
    workflow: {
      status: 'candidate',
      visibility: 'private',
      importedAt: '2026-07-28T00:00:00.000Z',
      reviewedAt: null,
      reviewedBy: null,
    },
  };
}

function plantCandidate(asset: ProcessingPlant): CommodityNodeAssetCandidate {
  return {
    candidateId: candidateId('processing_plant', asset.id),
    upstreamId: asset.id,
    kind: 'processing_plant',
    name: asset.name,
    latitude: asset.lat,
    longitude: asset.lon,
    country: asset.country,
    commodities: [asset.mineral, ...(asset.materials ?? [])],
    operator: asset.operator || null,
    source: {
      datasetId: 'worldmonitor-commodity-geography',
      locator: 'src/config/commodity-geo.ts',
      importedFrom: 'upstream',
    },
    workflow: {
      status: 'candidate',
      visibility: 'private',
      importedAt: '2026-07-28T00:00:00.000Z',
      reviewedAt: null,
      reviewedBy: null,
    },
  };
}

function portCandidate(asset: CommodityPort): CommodityNodeAssetCandidate {
  return {
    candidateId: candidateId('commodity_port', asset.id),
    upstreamId: asset.id,
    kind: 'commodity_port',
    name: asset.name,
    latitude: asset.lat,
    longitude: asset.lon,
    country: asset.country,
    commodities: [...asset.commodities],
    operator: null,
    source: {
      datasetId: 'worldmonitor-commodity-geography',
      locator: 'src/config/commodity-geo.ts',
      importedFrom: 'upstream',
    },
    workflow: {
      status: 'candidate',
      visibility: 'private',
      importedAt: '2026-07-28T00:00:00.000Z',
      reviewedAt: null,
      reviewedBy: null,
    },
  };
}

/**
 * Private intake inventory. Importing a row does not publish or verify it.
 * Promotion requires rights, claim, and reviewer records in the durable
 * registry; public renderers must not consume this collection directly.
 */
export const COMMODITYNODE_ASSET_CANDIDATES: readonly CommodityNodeAssetCandidate[] = [
  ...MINING_SITES.map(mineCandidate),
  ...PROCESSING_PLANTS.map(plantCandidate),
  ...COMMODITY_PORTS.map(portCandidate),
];

export function validateCommodityNodeAssetCandidates(
  candidates: readonly CommodityNodeAssetCandidate[] = COMMODITYNODE_ASSET_CANDIDATES,
): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const candidate of candidates) {
    if (ids.has(candidate.candidateId)) {
      errors.push(`Duplicate candidate ID: ${candidate.candidateId}`);
    }
    ids.add(candidate.candidateId);
    if (
      !Number.isFinite(candidate.latitude)
      || candidate.latitude < -90
      || candidate.latitude > 90
      || !Number.isFinite(candidate.longitude)
      || candidate.longitude < -180
      || candidate.longitude > 180
    ) {
      errors.push(`Invalid coordinates: ${candidate.candidateId}`);
    }
    if (candidate.workflow.status !== 'candidate' || candidate.workflow.visibility !== 'private') {
      errors.push(`Candidate escaped private intake: ${candidate.candidateId}`);
    }
    if (candidate.commodities.length === 0) {
      errors.push(`Commodity coverage missing: ${candidate.candidateId}`);
    }
  }

  return errors;
}
