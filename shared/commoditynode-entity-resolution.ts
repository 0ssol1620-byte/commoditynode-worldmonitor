import type { CommodityEntity } from './commodity-impact-ontology';

export interface CommodityNodeEntityResolution {
  status: 'resolved' | 'ambiguous' | 'unresolved';
  normalizedInput: string;
  entity: CommodityEntity | null;
  candidates: readonly CommodityEntity[];
}

export function normalizeCommodityNodeEntityName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function resolveCommodityNodeEntity(
  value: string,
  entities: readonly CommodityEntity[],
): CommodityNodeEntityResolution {
  const normalizedInput = normalizeCommodityNodeEntityName(value);
  if (!normalizedInput) {
    return { status: 'unresolved', normalizedInput, entity: null, candidates: [] };
  }

  const candidates = entities.filter((entity) =>
    [entity.id, entity.name, ...entity.aliases]
      .map(normalizeCommodityNodeEntityName)
      .includes(normalizedInput),
  );

  if (candidates.length === 1) {
    return {
      status: 'resolved',
      normalizedInput,
      entity: candidates[0] ?? null,
      candidates,
    };
  }
  return {
    status: candidates.length > 1 ? 'ambiguous' : 'unresolved',
    normalizedInput,
    entity: null,
    candidates,
  };
}

