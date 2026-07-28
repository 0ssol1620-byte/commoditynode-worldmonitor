export type CommodityUniverseGroup =
  | 'energy'
  | 'industrial-metals'
  | 'precious-metals'
  | 'agriculture';

export type CommodityInstrumentKind =
  | 'futures-benchmark'
  | 'regional-futures-benchmark'
  | 'etf-proxy';

export type CommodityRelationshipKind =
  | 'benchmark-peer'
  | 'refining-chain'
  | 'regional-peer'
  | 'substitution-set'
  | 'production-complex';

export interface CommodityUniverseNode {
  id: string;
  symbol: string;
  label: string;
  name: string;
  group: CommodityUniverseGroup;
  instrumentKind: CommodityInstrumentKind;
  instrumentLabel: string;
  coverageNote: string;
  x: number;
  y: number;
}

export interface CommodityUniverseEdge {
  id: string;
  source: string;
  target: string;
  kind: CommodityRelationshipKind;
  label: string;
  directed: boolean;
}

export const COMMODITY_GROUP_LABELS: Record<CommodityUniverseGroup, string> = {
  energy: 'Energy',
  'industrial-metals': 'Industrial & transition metals',
  'precious-metals': 'Precious metals',
  agriculture: 'Agriculture',
};

/**
 * A deterministic analytical layout, not a claim about market size or liquidity.
 * Every non-FX instrument in shared/commodities.json appears exactly once.
 */
export const COMMODITY_UNIVERSE_NODES: readonly CommodityUniverseNode[] = [
  {
    id: 'gold',
    symbol: 'GC=F',
    label: 'Gold',
    name: 'Gold',
    group: 'precious-metals',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'COMEX gold futures proxy',
    x: 130,
    y: 135,
  },
  {
    id: 'silver',
    symbol: 'SI=F',
    label: 'Silver',
    name: 'Silver',
    group: 'precious-metals',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'COMEX silver futures proxy',
    x: 255,
    y: 95,
  },
  {
    id: 'platinum',
    symbol: 'PL=F',
    label: 'Platinum',
    name: 'Platinum',
    group: 'precious-metals',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'NYMEX platinum futures proxy',
    x: 365,
    y: 165,
  },
  {
    id: 'palladium',
    symbol: 'PA=F',
    label: 'Palladium',
    name: 'Palladium',
    group: 'precious-metals',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'NYMEX palladium futures proxy',
    x: 265,
    y: 235,
  },
  {
    id: 'copper',
    symbol: 'HG=F',
    label: 'Copper',
    name: 'Copper',
    group: 'industrial-metals',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'COMEX copper futures proxy',
    x: 120,
    y: 390,
  },
  {
    id: 'aluminum',
    symbol: 'ALI=F',
    label: 'Aluminum',
    name: 'Aluminum',
    group: 'industrial-metals',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'Aluminum futures proxy',
    x: 265,
    y: 345,
  },
  {
    id: 'lithium',
    symbol: 'LIT',
    label: 'Lithium',
    name: 'Lithium & Battery',
    group: 'industrial-metals',
    instrumentKind: 'etf-proxy',
    instrumentLabel: 'ETF proxy',
    coverageNote: 'Global X Lithium & Battery Tech ETF; not a spot lithium benchmark',
    x: 370,
    y: 445,
  },
  {
    id: 'uranium',
    symbol: 'URA',
    label: 'Uranium',
    name: 'Uranium',
    group: 'industrial-metals',
    instrumentKind: 'etf-proxy',
    instrumentLabel: 'ETF proxy',
    coverageNote: 'Global X Uranium ETF; not a spot uranium benchmark',
    x: 225,
    y: 510,
  },
  {
    id: 'wti',
    symbol: 'CL=F',
    label: 'WTI',
    name: 'Crude Oil WTI',
    group: 'energy',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'NYMEX WTI crude oil futures proxy',
    x: 585,
    y: 100,
  },
  {
    id: 'brent',
    symbol: 'BZ=F',
    label: 'Brent',
    name: 'Brent Crude',
    group: 'energy',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'ICE Brent crude futures proxy',
    x: 730,
    y: 85,
  },
  {
    id: 'natural-gas',
    symbol: 'NG=F',
    label: 'Natural gas',
    name: 'Natural Gas',
    group: 'energy',
    instrumentKind: 'regional-futures-benchmark',
    instrumentLabel: 'Regional futures benchmark',
    coverageNote: 'Henry Hub natural gas futures proxy',
    x: 850,
    y: 145,
  },
  {
    id: 'ttf-gas',
    symbol: 'TTF=F',
    label: 'TTF gas',
    name: 'TTF Natural Gas',
    group: 'energy',
    instrumentKind: 'regional-futures-benchmark',
    instrumentLabel: 'Regional futures benchmark',
    coverageNote: 'European TTF natural gas futures proxy',
    x: 895,
    y: 250,
  },
  {
    id: 'gasoline',
    symbol: 'RB=F',
    label: 'Gasoline',
    name: 'Gasoline RBOB',
    group: 'energy',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'NYMEX RBOB gasoline futures proxy',
    x: 700,
    y: 205,
  },
  {
    id: 'heating-oil',
    symbol: 'HO=F',
    label: 'Heating oil',
    name: 'Heating Oil',
    group: 'energy',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'NYMEX heating oil futures proxy',
    x: 575,
    y: 265,
  },
  {
    id: 'coal',
    symbol: 'MTF=F',
    label: 'Coal',
    name: 'Newcastle Coal',
    group: 'energy',
    instrumentKind: 'regional-futures-benchmark',
    instrumentLabel: 'Regional futures benchmark',
    coverageNote: 'Newcastle coal futures proxy',
    x: 790,
    y: 320,
  },
  {
    id: 'wheat',
    symbol: 'ZW=F',
    label: 'Wheat',
    name: 'Wheat',
    group: 'agriculture',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'CBOT wheat futures proxy',
    x: 500,
    y: 420,
  },
  {
    id: 'corn',
    symbol: 'ZC=F',
    label: 'Corn',
    name: 'Corn',
    group: 'agriculture',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'CBOT corn futures proxy',
    x: 620,
    y: 385,
  },
  {
    id: 'soybeans',
    symbol: 'ZS=F',
    label: 'Soybeans',
    name: 'Soybeans',
    group: 'agriculture',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'CBOT soybean futures proxy',
    x: 745,
    y: 405,
  },
  {
    id: 'rice',
    symbol: 'ZR=F',
    label: 'Rice',
    name: 'Rough Rice',
    group: 'agriculture',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'CBOT rough rice futures proxy',
    x: 865,
    y: 435,
  },
  {
    id: 'coffee',
    symbol: 'KC=F',
    label: 'Coffee',
    name: 'Coffee',
    group: 'agriculture',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'ICE coffee futures proxy',
    x: 520,
    y: 535,
  },
  {
    id: 'sugar',
    symbol: 'SB=F',
    label: 'Sugar',
    name: 'Sugar No. 11',
    group: 'agriculture',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'ICE Sugar No. 11 futures proxy',
    x: 650,
    y: 520,
  },
  {
    id: 'cocoa',
    symbol: 'CC=F',
    label: 'Cocoa',
    name: 'Cocoa',
    group: 'agriculture',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'ICE cocoa futures proxy',
    x: 785,
    y: 545,
  },
  {
    id: 'cotton',
    symbol: 'CT=F',
    label: 'Cotton',
    name: 'Cotton',
    group: 'agriculture',
    instrumentKind: 'futures-benchmark',
    instrumentLabel: 'Futures benchmark',
    coverageNote: 'ICE cotton futures proxy',
    x: 910,
    y: 525,
  },
];

export const COMMODITY_UNIVERSE_EDGES: readonly CommodityUniverseEdge[] = [
  { id: 'gold-silver', source: 'gold', target: 'silver', kind: 'substitution-set', label: 'precious-metal peer', directed: false },
  { id: 'platinum-palladium', source: 'platinum', target: 'palladium', kind: 'production-complex', label: 'PGM peer', directed: false },
  { id: 'silver-platinum', source: 'silver', target: 'platinum', kind: 'substitution-set', label: 'precious-metal peer', directed: false },
  { id: 'copper-aluminum', source: 'copper', target: 'aluminum', kind: 'substitution-set', label: 'conductive-metal substitute set', directed: false },
  { id: 'copper-lithium', source: 'copper', target: 'lithium', kind: 'production-complex', label: 'electrification input set', directed: false },
  { id: 'lithium-uranium', source: 'lithium', target: 'uranium', kind: 'production-complex', label: 'energy-transition exposure set', directed: false },
  { id: 'wti-brent', source: 'wti', target: 'brent', kind: 'benchmark-peer', label: 'crude benchmark peer', directed: false },
  { id: 'wti-gasoline', source: 'wti', target: 'gasoline', kind: 'refining-chain', label: 'refining input', directed: true },
  { id: 'wti-heating-oil', source: 'wti', target: 'heating-oil', kind: 'refining-chain', label: 'refining input', directed: true },
  { id: 'natural-gas-ttf', source: 'natural-gas', target: 'ttf-gas', kind: 'regional-peer', label: 'regional gas benchmark peer', directed: false },
  { id: 'natural-gas-coal', source: 'natural-gas', target: 'coal', kind: 'substitution-set', label: 'power-generation fuel set', directed: false },
  { id: 'wheat-corn', source: 'wheat', target: 'corn', kind: 'substitution-set', label: 'grain complex', directed: false },
  { id: 'corn-soybeans', source: 'corn', target: 'soybeans', kind: 'production-complex', label: 'row-crop complex', directed: false },
  { id: 'wheat-rice', source: 'wheat', target: 'rice', kind: 'substitution-set', label: 'staple-grain set', directed: false },
  { id: 'coffee-cocoa', source: 'coffee', target: 'cocoa', kind: 'production-complex', label: 'tropical softs set', directed: false },
  { id: 'sugar-cocoa', source: 'sugar', target: 'cocoa', kind: 'production-complex', label: 'food-input set', directed: false },
  { id: 'sugar-cotton', source: 'sugar', target: 'cotton', kind: 'production-complex', label: 'soft-commodity set', directed: false },
];

const NODE_BY_ID = new Map(COMMODITY_UNIVERSE_NODES.map((node) => [node.id, node]));

export function getCommodityUniverseNode(id: string): CommodityUniverseNode | undefined {
  return NODE_BY_ID.get(id);
}

export function getCommodityUniverseEdgesForNode(id: string): CommodityUniverseEdge[] {
  return COMMODITY_UNIVERSE_EDGES.filter((edge) => edge.source === id || edge.target === id);
}

export function getCommodityUniverseNeighbor(
  edge: CommodityUniverseEdge,
  nodeId: string,
): CommodityUniverseNode | undefined {
  return NODE_BY_ID.get(edge.source === nodeId ? edge.target : edge.source);
}

export function getCommodityUniverseNodeIdForLabel(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const aliases: Readonly<Record<string, string>> = {
    aluminium: 'aluminum',
    'crude oil': 'wti',
    oil: 'wti',
    'natural gas': 'natural-gas',
  };
  const direct = aliases[normalized] ?? normalized;
  return COMMODITY_UNIVERSE_NODES.find((node) =>
    [node.id, node.label, node.name]
      .map((candidate) =>
        candidate
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase('en-US')
          .replace(/[^a-z0-9]+/g, ' ')
          .trim(),
      )
      .includes(direct),
  )?.id ?? null;
}

export function validateCommodityUniverseModel(): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  const symbols = new Set<string>();

  for (const node of COMMODITY_UNIVERSE_NODES) {
    if (ids.has(node.id)) issues.push(`duplicate node id: ${node.id}`);
    if (symbols.has(node.symbol)) issues.push(`duplicate node symbol: ${node.symbol}`);
    ids.add(node.id);
    symbols.add(node.symbol);
    if (node.x < 0 || node.x > 1000 || node.y < 0 || node.y > 620) {
      issues.push(`node outside viewBox: ${node.id}`);
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of COMMODITY_UNIVERSE_EDGES) {
    if (edgeIds.has(edge.id)) issues.push(`duplicate edge id: ${edge.id}`);
    edgeIds.add(edge.id);
    if (!ids.has(edge.source)) issues.push(`unknown edge source: ${edge.source}`);
    if (!ids.has(edge.target)) issues.push(`unknown edge target: ${edge.target}`);
    if (edge.source === edge.target) issues.push(`self edge: ${edge.id}`);
  }

  return issues;
}
