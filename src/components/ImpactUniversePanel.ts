import { Panel } from './Panel';
import {
  COMMODITY_GROUP_LABELS,
  COMMODITY_UNIVERSE_EDGES,
  COMMODITY_UNIVERSE_NODES,
  getCommodityUniverseEdgesForNode,
  getCommodityUniverseNeighbor,
  getCommodityUniverseNode,
  type CommodityUniverseGroup,
  type CommodityUniverseNode,
} from '@/config/commoditynode-universe';
import { formatChange, formatPrice } from '@/utils';

export interface ImpactUniverseQuote {
  symbol?: string;
  display: string;
  price: number | null;
  change: number | null;
}

type UniverseView = 'graph' | 'table';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function textElement(className: string, text: string): HTMLElement {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  return element;
}

function quoteState(quote: ImpactUniverseQuote | undefined): 'up' | 'down' | 'flat' | 'unavailable' {
  if (!quote || quote.price === null || !Number.isFinite(quote.price)) return 'unavailable';
  if (typeof quote.change !== 'number' || !Number.isFinite(quote.change) || quote.change === 0) return 'flat';
  return quote.change > 0 ? 'up' : 'down';
}

function quoteChange(quote: ImpactUniverseQuote | undefined): string {
  return typeof quote?.change === 'number' && Number.isFinite(quote.change)
    ? formatChange(quote.change)
    : 'Change unavailable';
}

function quotePrice(quote: ImpactUniverseQuote | undefined): string {
  return typeof quote?.price === 'number' && Number.isFinite(quote.price)
    ? formatPrice(quote.price)
    : 'Price unavailable';
}

export class ImpactUniversePanel extends Panel {
  private quotes = new Map<string, ImpactUniverseQuote>();
  private selectedId = 'copper';
  private view: UniverseView;

  constructor() {
    super({
      id: 'impact-universe',
      title: 'Impact Universe',
      className: 'panel-wide cn-universe-panel',
      defaultRowSpan: 3,
      infoTooltip:
        'All tracked commodity instruments appear as equal nodes. Lines identify a named analytical relationship, not a forecast. ETF proxies are labeled separately from futures benchmarks.',
    });
    this.view = window.matchMedia('(max-width: 720px)').matches ? 'table' : 'graph';
    this.content.classList.add('cn-universe-content');
    this.content.addEventListener('click', (event) => this.handleClick(event));
    this.content.addEventListener('keydown', (event) => this.handleKeydown(event));
    this.render();
  }

  public renderCommodities(data: ImpactUniverseQuote[]): void {
    this.quotes = new Map(
      data
        .filter((quote) => typeof quote.symbol === 'string')
        .map((quote) => [quote.symbol as string, quote]),
    );
    this.render();
  }

  private handleClick(event: Event): void {
    const target = event.target as Element;
    const viewButton = target.closest<HTMLElement>('[data-universe-view]');
    const nextView = viewButton?.dataset.universeView;
    if (nextView === 'graph' || nextView === 'table') {
      this.view = nextView;
      this.render();
      return;
    }

    const node = target.closest<HTMLElement>('[data-universe-node]');
    if (node?.dataset.universeNode) {
      this.selectedId = node.dataset.universeNode;
      this.render();
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    const target = (event.target as Element).closest<HTMLElement>('[data-universe-node]');
    if (!target) return;
    const currentIndex = COMMODITY_UNIVERSE_NODES.findIndex(
      (node) => node.id === target.dataset.universeNode,
    );
    if (currentIndex < 0) return;

    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const nextIndex =
      (currentIndex + delta + COMMODITY_UNIVERSE_NODES.length) %
      COMMODITY_UNIVERSE_NODES.length;
    const next = COMMODITY_UNIVERSE_NODES[nextIndex];
    if (!next) return;
    this.selectedId = next.id;
    this.render();
    this.content
      .querySelector<HTMLElement>(`[data-universe-node="${next.id}"]`)
      ?.focus();
  }

  private render(): void {
    const shell = document.createElement('div');
    shell.className = 'cn-universe-shell';
    shell.append(this.buildIntro(), this.buildToolbar());

    const body = document.createElement('div');
    body.className = `cn-universe-body is-${this.view}`;
    if (this.view === 'graph') body.appendChild(this.buildGraph());
    else body.appendChild(this.buildTable());
    body.appendChild(this.buildInspector());
    shell.appendChild(body);

    this.content.replaceChildren(shell);
  }

  private buildIntro(): HTMLElement {
    const intro = document.createElement('div');
    intro.className = 'cn-universe-intro';
    const copy = document.createElement('div');
    copy.append(
      textElement('cn-universe-eyebrow', 'RELATIONSHIP MODEL · 23 INSTRUMENTS'),
      textElement('cn-universe-title', 'The full commodity universe'),
      textElement(
        'cn-universe-description',
        'Select any commodity to inspect its benchmark type, live quote coverage, and named links. Position and node size carry no market-value meaning.',
      ),
    );
    const legend = document.createElement('div');
    legend.className = 'cn-universe-legend';
    for (const group of Object.keys(COMMODITY_GROUP_LABELS) as CommodityUniverseGroup[]) {
      const item = document.createElement('span');
      item.className = `cn-universe-legend-item group-${group}`;
      item.append(textElement('cn-universe-legend-mark', ''), COMMODITY_GROUP_LABELS[group]);
      legend.appendChild(item);
    }
    intro.append(copy, legend);
    return intro;
  }

  private buildToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'cn-universe-toolbar';
    toolbar.setAttribute('aria-label', 'Impact Universe view');
    for (const view of ['graph', 'table'] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cn-universe-view-button';
      button.dataset.universeView = view;
      button.setAttribute('aria-pressed', String(this.view === view));
      button.textContent = view === 'graph' ? 'Universe' : 'Accessible table';
      toolbar.appendChild(button);
    }
    return toolbar;
  }

  private buildGraph(): SVGSVGElement {
    const svg = svgElement('svg', {
      class: 'cn-universe-graph',
      viewBox: '0 0 1000 620',
      role: 'group',
      'aria-labelledby': 'cn-universe-graph-title cn-universe-graph-description',
    });
    const title = svgElement('title', { id: 'cn-universe-graph-title' });
    title.textContent = 'Commodity relationship universe';
    const description = svgElement('desc', { id: 'cn-universe-graph-description' });
    description.textContent =
      'Twenty-three commodity instruments grouped by energy, industrial metals, precious metals, and agriculture. Use arrow keys to move between nodes.';
    svg.append(title, description);

    const backdrop = svgElement('g', { class: 'cn-universe-backdrop', 'aria-hidden': 'true' });
    for (const radius of [150, 250, 350, 445]) {
      backdrop.appendChild(
        svgElement('ellipse', {
          cx: '500',
          cy: '310',
          rx: String(radius),
          ry: String(Math.round(radius * 0.58)),
        }),
      );
    }
    const stars = [
      [60, 75], [185, 300], [315, 55], [430, 265], [470, 90], [535, 330],
      [660, 300], [815, 365], [925, 80], [955, 345], [455, 565], [45, 545],
    ];
    for (const [cx, cy] of stars) {
      backdrop.appendChild(svgElement('circle', { cx: String(cx), cy: String(cy), r: '1.5' }));
    }
    svg.appendChild(backdrop);

    const selectedEdges = new Set(
      getCommodityUniverseEdgesForNode(this.selectedId).map((edge) => edge.id),
    );
    const edgeLayer = svgElement('g', { class: 'cn-universe-edges', 'aria-hidden': 'true' });
    for (const edge of COMMODITY_UNIVERSE_EDGES) {
      const source = getCommodityUniverseNode(edge.source);
      const target = getCommodityUniverseNode(edge.target);
      if (!source || !target) continue;
      edgeLayer.appendChild(
        svgElement('line', {
          x1: String(source.x),
          y1: String(source.y),
          x2: String(target.x),
          y2: String(target.y),
          class: selectedEdges.has(edge.id) ? 'is-related' : '',
          'data-edge-kind': edge.kind,
        }),
      );
    }
    svg.appendChild(edgeLayer);

    const nodeLayer = svgElement('g', { class: 'cn-universe-nodes' });
    for (const node of COMMODITY_UNIVERSE_NODES) {
      nodeLayer.appendChild(this.buildGraphNode(node, selectedEdges));
    }
    svg.appendChild(nodeLayer);
    return svg;
  }

  private buildGraphNode(
    node: CommodityUniverseNode,
    selectedEdges: Set<string>,
  ): SVGGElement {
    const quote = this.quotes.get(node.symbol);
    const state = quoteState(quote);
    const isSelected = node.id === this.selectedId;
    const isRelated =
      isSelected ||
      getCommodityUniverseEdgesForNode(node.id).some((edge) => selectedEdges.has(edge.id));
    const group = svgElement('g', {
      class: [
        'cn-universe-node',
        `group-${node.group}`,
        `state-${state}`,
        isSelected ? 'is-selected' : '',
        isRelated ? 'is-related' : '',
      ].filter(Boolean).join(' '),
      transform: `translate(${node.x} ${node.y})`,
      tabindex: '0',
      role: 'button',
      'aria-pressed': String(isSelected),
      'aria-label': `${node.name}, ${node.instrumentLabel}, ${quotePrice(quote)}, ${quoteChange(quote)}`,
      'data-universe-node': node.id,
    });
    group.appendChild(svgElement('circle', { class: 'cn-universe-node-orbit', r: '30' }));
    group.appendChild(svgElement('circle', { class: 'cn-universe-node-planet', r: '17' }));
    group.appendChild(svgElement('circle', { class: 'cn-universe-node-state', r: '4', cx: '13', cy: '-13' }));

    const label = svgElement('text', {
      class: 'cn-universe-node-label',
      x: '0',
      y: '39',
      'text-anchor': 'middle',
    });
    label.textContent = node.label;
    const change = svgElement('text', {
      class: 'cn-universe-node-change',
      x: '0',
      y: '52',
      'text-anchor': 'middle',
    });
    change.textContent =
      typeof quote?.change === 'number' && Number.isFinite(quote.change)
        ? formatChange(quote.change)
        : '—';
    group.append(label, change);
    return group;
  }

  private buildTable(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cn-universe-table-wrap';
    const table = document.createElement('table');
    table.className = 'cn-universe-table';
    const caption = document.createElement('caption');
    caption.textContent = 'All commodity instruments and current quote coverage';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const label of ['Commodity', 'Group', 'Instrument', 'Price', 'Session move', 'Coverage']) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = label;
      headRow.appendChild(cell);
    }
    head.appendChild(headRow);
    const body = document.createElement('tbody');

    for (const node of COMMODITY_UNIVERSE_NODES) {
      const quote = this.quotes.get(node.symbol);
      const row = document.createElement('tr');
      row.className = node.id === this.selectedId ? 'is-selected' : '';
      const nameCell = document.createElement('th');
      nameCell.scope = 'row';
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.universeNode = node.id;
      button.setAttribute('aria-pressed', String(node.id === this.selectedId));
      button.textContent = node.name;
      nameCell.appendChild(button);
      const values = [
        COMMODITY_GROUP_LABELS[node.group],
        node.instrumentLabel,
        quotePrice(quote),
        quoteChange(quote),
        quoteState(quote) === 'unavailable' ? 'Unavailable' : 'Available',
      ];
      row.appendChild(nameCell);
      for (const value of values) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      }
      body.appendChild(row);
    }

    table.append(caption, head, body);
    wrapper.appendChild(table);
    return wrapper;
  }

  private buildInspector(): HTMLElement {
    const node = getCommodityUniverseNode(this.selectedId) ?? COMMODITY_UNIVERSE_NODES[0];
    if (!node) return document.createElement('aside');
    const quote = this.quotes.get(node.symbol);
    const inspector = document.createElement('aside');
    inspector.className = 'cn-universe-inspector';
    inspector.setAttribute('aria-live', 'polite');

    const heading = document.createElement('div');
    heading.className = 'cn-universe-inspector-heading';
    const title = document.createElement('h3');
    title.textContent = node.name;
    heading.append(
      textElement('cn-universe-eyebrow', 'SELECTED INSTRUMENT'),
      title,
      textElement('cn-universe-symbol', node.symbol),
    );

    const metrics = document.createElement('dl');
    metrics.className = 'cn-universe-metrics';
    const items: Array<readonly [string, string]> = [
      ['Group', COMMODITY_GROUP_LABELS[node.group]],
      ['Instrument', node.instrumentLabel],
      ['Last price', quotePrice(quote)],
      ['Session move', quoteChange(quote)],
      ['Quote coverage', quoteState(quote) === 'unavailable' ? 'Unavailable' : 'Available'],
    ];
    for (const [term, value] of items) {
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      dd.textContent = value;
      if (term === 'Session move') dd.dataset.state = quoteState(quote);
      metrics.append(dt, dd);
    }

    const note = document.createElement('p');
    note.className = 'cn-universe-coverage-note';
    note.textContent = node.coverageNote;

    const relatedTitle = document.createElement('h4');
    relatedTitle.textContent = 'Named relationships';
    const list = document.createElement('ul');
    list.className = 'cn-universe-path-list';
    const edges = getCommodityUniverseEdgesForNode(node.id);
    if (edges.length === 0) {
      const item = document.createElement('li');
      item.textContent = 'No published relationship in taxonomy v1.';
      list.appendChild(item);
    } else {
      for (const edge of edges) {
        const neighbor = getCommodityUniverseNeighbor(edge, node.id);
        if (!neighbor) continue;
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.universeNode = neighbor.id;
        button.textContent = neighbor.name;
        item.append(button, textElement('cn-universe-edge-label', edge.label));
        list.appendChild(item);
      }
    }

    const methodology = document.createElement('a');
    methodology.className = 'cn-universe-methodology';
    methodology.href = 'https://commoditynode.com/posts/read-commodity-relationship-graph/';
    methodology.target = '_blank';
    methodology.rel = 'noopener';
    methodology.textContent = 'Read graph methodology';

    inspector.append(heading, metrics, note, relatedTitle, list, methodology);
    return inspector;
  }
}
