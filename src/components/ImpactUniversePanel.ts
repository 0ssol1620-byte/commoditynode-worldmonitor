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
import {
  COBRE_PANAMA_GRAPH_SNAPSHOT,
  COBRE_PANAMA_IMPACT_EVENT,
  COBRE_PANAMA_PLAYBACK_SNAPSHOTS,
  COBRE_PANAMA_TIMELINE,
} from '../../shared/commoditynode-cobre-panama-impact';
import type { PublishedImpactEdge } from '../../shared/commodity-impact-ontology';
import { findImpactPaths } from '@/services/commodity-impact-graph';
import { getAuthState } from '@/services/auth-state';
import { openSignIn } from '@/services/clerk';
import {
  isCommodityNodeAccountServiceConfigured,
  listCommodityNodeSavedEntities,
  setCommodityNodeEntitySaved,
} from '@/services/commoditynode-product';
import { trackCommodityNodeEvent } from '@/services/commoditynode-analytics';

export interface ImpactUniverseQuote {
  symbol?: string;
  display: string;
  price: number | null;
  change: number | null;
}

type UniverseView = 'graph' | 'table';
type UniverseFocus = CommodityUniverseGroup | 'all';

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
  private selectedEvidenceId: string | null = 'edge-cobre-produces-copper';
  private view: UniverseView;
  private focusedGroup: UniverseFocus = 'all';
  private timelineIndex = COBRE_PANAMA_PLAYBACK_SNAPSHOTS.length - 1;
  private savedCommodityIds = new Set<string>();
  private savedStateAccountId: string | null = null;
  private savedStateRequest = 0;
  private savedActionPending = false;
  private readonly mapSelectionHandler = ((event: CustomEvent<{ commodityId?: string }>) => {
    const id = event.detail?.commodityId;
    if (id && getCommodityUniverseNode(id)) {
      this.selectedId = id;
      this.selectedEvidenceId = id === 'copper' ? 'edge-cobre-produces-copper' : null;
      this.render();
    }
  }) as EventListener;

  constructor() {
    super({
      id: 'impact-universe',
      title: 'Impact Universe',
      className: 'panel-wide cn-universe-panel',
      defaultRowSpan: 4,
      infoTooltip:
        'All tracked commodity instruments appear as equal nodes. Lines identify a named analytical relationship, not a forecast. ETF proxies are labeled separately from futures benchmarks.',
    });
    this.view = window.matchMedia('(max-width: 720px)').matches ? 'table' : 'graph';
    this.content.classList.add('cn-universe-content');
    this.content.addEventListener('click', (event) => this.handleClick(event));
    this.content.addEventListener('keydown', (event) => this.handleKeydown(event));
    window.addEventListener('commoditynode:map-selection', this.mapSelectionHandler);
    this.render();
  }

  override destroy(): void {
    window.removeEventListener('commoditynode:map-selection', this.mapSelectionHandler);
    super.destroy();
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
    const saveButton = target.closest<HTMLButtonElement>('[data-universe-save]');
    if (saveButton?.dataset.universeSave) {
      void this.toggleSavedCommodity(saveButton.dataset.universeSave);
      return;
    }

    const viewButton = target.closest<HTMLElement>('[data-universe-view]');
    const nextView = viewButton?.dataset.universeView;
    if (nextView === 'graph' || nextView === 'table') {
      this.view = nextView;
      this.render();
      return;
    }

    const evidence = target.closest<HTMLElement>('[data-universe-evidence]');
    if (evidence?.dataset.universeEvidence) {
      this.selectedEvidenceId =
        this.selectedEvidenceId === evidence.dataset.universeEvidence
          ? null
          : evidence.dataset.universeEvidence;
      this.render();
      return;
    }

    const group = target.closest<HTMLElement>('[data-universe-group]');
    const nextGroup = group?.dataset.universeGroup as UniverseFocus | undefined;
    if (
      nextGroup === 'all'
      || (nextGroup
        && Object.prototype.hasOwnProperty.call(COMMODITY_GROUP_LABELS, nextGroup))
    ) {
      this.focusedGroup = nextGroup;
      const selected = getCommodityUniverseNode(this.selectedId);
      if (nextGroup !== 'all' && selected?.group !== nextGroup) {
        this.selectedId =
          COMMODITY_UNIVERSE_NODES.find((candidate) => candidate.group === nextGroup)?.id
          ?? this.selectedId;
        this.selectedEvidenceId =
          this.selectedId === 'copper' ? 'edge-cobre-produces-copper' : null;
      }
      this.render();
      return;
    }

    const timeline = target.closest<HTMLElement>('[data-universe-timeline]');
    const timelineDirection = timeline?.dataset.universeTimeline;
    if (timelineDirection === 'previous' || timelineDirection === 'next') {
      this.timelineIndex = Math.min(
        COBRE_PANAMA_PLAYBACK_SNAPSHOTS.length - 1,
        Math.max(
          0,
          this.timelineIndex + (timelineDirection === 'previous' ? -1 : 1),
        ),
      );
      this.selectedEvidenceId =
        this.timelineIndex < 2
          ? 'edge-cobre-located-colon'
          : 'edge-cobre-produces-copper';
      this.render();
      return;
    }

    const node = target.closest<HTMLElement>('[data-universe-node]');
    if (node?.dataset.universeNode) {
      this.selectedId = node.dataset.universeNode;
      this.selectedEvidenceId =
        this.selectedId === 'copper' ? 'edge-cobre-produces-copper' : null;
      window.dispatchEvent(
        new CustomEvent('commoditynode:universe-selection', {
          detail: { commodityId: this.selectedId },
        }),
      );
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
    this.selectedEvidenceId =
      this.selectedId === 'copper' ? 'edge-cobre-produces-copper' : null;
    window.dispatchEvent(
      new CustomEvent('commoditynode:universe-selection', {
        detail: { commodityId: this.selectedId },
      }),
    );
    this.render();
    this.content
      .querySelector<HTMLElement>(`[data-universe-node="${next.id}"]`)
      ?.focus();
  }

  private render(): void {
    const shell = document.createElement('div');
    shell.className = 'cn-universe-shell';
    shell.append(this.buildIntro(), this.buildPrimaryPath(), this.buildToolbar());

    const body = document.createElement('div');
    body.className = `cn-universe-body is-${this.view}`;
    if (this.view === 'graph') body.appendChild(this.buildGraph());
    else body.appendChild(this.buildTable());
    body.appendChild(this.buildInspector());
    shell.appendChild(body);

    this.content.replaceChildren(shell);
    void this.hydrateSavedCommodityState();
  }

  private buildIntro(): HTMLElement {
    const intro = document.createElement('div');
    intro.className = 'cn-universe-intro';
    const copy = document.createElement('div');
    copy.append(
      textElement('cn-universe-eyebrow', 'IMPACT PATHS · 23 TRACKED INSTRUMENTS'),
      textElement('cn-universe-title', 'Where can a physical disruption travel next?'),
      textElement(
        'cn-universe-description',
        'Read the reviewed impact path first, then use the universe as an instrument directory. A line means a named relationship; missing links are never implied by proximity.',
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

  private buildPrimaryPath(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'cn-universe-primary-path';
    section.setAttribute('aria-labelledby', 'cn-universe-primary-path-title');

    const heading = document.createElement('div');
    heading.className = 'cn-universe-primary-path-heading';
    const label = textElement('cn-universe-eyebrow', 'REVIEWED HISTORICAL CASE');
    const title = document.createElement('h3');
    title.id = 'cn-universe-primary-path-title';
    title.textContent = 'Cobre Panama: from production halt to copper exposure';
    const note = document.createElement('p');
    note.textContent =
      'Evidence-backed facts end at the physical supply impact. Benchmark response remains an inference to test, not a prediction.';
    heading.append(label, title, note);

    const path = document.createElement('ol');
    path.className = 'cn-universe-primary-path-list';
    const steps: Array<readonly [string, string, string]> = [
      ['Event', 'Production halted', 'Verified historical event'],
      ['Asset', 'Cobre Panama mine', 'Named producing asset'],
      ['Flow', 'Copper concentrate', 'Physical supply removed'],
      ['Exposure', 'Copper benchmarks', 'Inference requiring validation'],
    ];
    for (const [kind, name, status] of steps) {
      const item = document.createElement('li');
      item.dataset.kind = kind.toLowerCase();
      item.append(
        textElement('cn-universe-path-kind', kind),
        textElement('cn-universe-path-name', name),
        textElement('cn-universe-path-status', status),
      );
      path.appendChild(item);
    }

    section.append(heading, path);
    return section;
  }

  private buildToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'cn-universe-toolbar';
    const clusters = document.createElement('div');
    clusters.className = 'cn-universe-clusters';
    clusters.setAttribute('aria-label', 'Commodity semantic cluster');
    const groups: Array<readonly [UniverseFocus, string]> = [
      ['all', 'All 23'],
      ['energy', 'Energy'],
      ['industrial-metals', 'Metals'],
      ['precious-metals', 'Precious'],
      ['agriculture', 'Agriculture'],
    ];
    for (const [group, label] of groups) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cn-universe-cluster-button';
      button.dataset.universeGroup = group;
      button.setAttribute('aria-pressed', String(this.focusedGroup === group));
      button.textContent = label;
      clusters.appendChild(button);
    }

    const views = document.createElement('div');
    views.className = 'cn-universe-views';
    views.setAttribute('aria-label', 'Impact Universe view');
    for (const view of ['graph', 'table'] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cn-universe-view-button';
      button.dataset.universeView = view;
      button.setAttribute('aria-pressed', String(this.view === view));
      button.textContent = view === 'graph' ? 'Universe' : 'Accessible table';
      views.appendChild(button);
    }
    toolbar.append(clusters, views);
    return toolbar;
  }

  private buildGraph(): HTMLElement {
    const stage = document.createElement('div');
    stage.className = 'cn-universe-graph-stage';

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
      const isDimmed =
        this.focusedGroup !== 'all'
        && source.group !== this.focusedGroup
        && target.group !== this.focusedGroup;
      edgeLayer.appendChild(
        svgElement('line', {
          x1: String(source.x),
          y1: String(source.y),
          x2: String(target.x),
          y2: String(target.y),
          class: [
            selectedEdges.has(edge.id) ? 'is-related' : '',
            isDimmed ? 'is-dimmed' : '',
          ]
            .filter(Boolean)
            .join(' '),
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
    stage.append(svg);
    return stage;
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
        this.focusedGroup !== 'all' && node.group !== this.focusedGroup
          ? 'is-dimmed'
          : '',
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
    caption.textContent =
      this.focusedGroup === 'all'
        ? 'All commodity instruments and current quote coverage'
        : `${COMMODITY_GROUP_LABELS[this.focusedGroup]} instruments and current quote coverage`;
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

    const visibleNodes =
      this.focusedGroup === 'all'
        ? COMMODITY_UNIVERSE_NODES
        : COMMODITY_UNIVERSE_NODES.filter(
            (node) => node.group === this.focusedGroup,
          );
    for (const node of visibleNodes) {
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

    const actions = document.createElement('div');
    actions.className = 'cn-universe-product-actions';
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.dataset.universeSave = node.id;
    saveButton.setAttribute('aria-describedby', 'cn-universe-action-status');
    saveButton.setAttribute('aria-pressed', String(this.savedCommodityIds.has(node.id)));
    saveButton.textContent = this.savedCommodityIds.has(node.id)
      ? 'Saved to watchlist'
      : 'Save commodity';
    const actionStatus = document.createElement('p');
    actionStatus.id = 'cn-universe-action-status';
    actionStatus.className = 'cn-universe-action-status';
    actionStatus.dataset.universeActionStatus = '';
    actionStatus.setAttribute('role', 'status');
    actionStatus.setAttribute('aria-live', 'polite');
    if (!isCommodityNodeAccountServiceConfigured()) {
      actionStatus.textContent =
        'Account watchlists are not available on this deployment.';
    }
    actions.append(saveButton, actionStatus);

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

    inspector.append(heading, metrics, note, actions);
    if (node.id === 'copper') inspector.appendChild(this.buildCopperEvidenceCase());
    inspector.append(relatedTitle, list, methodology);
    return inspector;
  }

  private async hydrateSavedCommodityState(): Promise<void> {
    if (!isCommodityNodeAccountServiceConfigured()) {
      this.updateSavedAction();
      this.setSavedActionStatus(
        'Account watchlists are not available on this deployment.',
      );
      return;
    }
    const accountId = getAuthState().user?.id ?? null;
    if (!accountId) {
      this.savedCommodityIds.clear();
      this.savedStateAccountId = null;
      this.updateSavedAction();
      return;
    }
    if (this.savedStateAccountId === accountId) {
      this.updateSavedAction();
      return;
    }
    const request = ++this.savedStateRequest;
    this.setSavedActionStatus('Loading saved commodities…');
    try {
      const entities = await listCommodityNodeSavedEntities();
      if (request !== this.savedStateRequest || getAuthState().user?.id !== accountId) return;
      this.savedCommodityIds = new Set(
        entities
          .filter((entity) => entity.entityType === 'commodity')
          .map((entity) => entity.entityId),
      );
      this.savedStateAccountId = accountId;
      this.updateSavedAction();
      this.setSavedActionStatus('');
    } catch {
      if (request !== this.savedStateRequest) return;
      this.setSavedActionStatus('Saved items are unavailable right now.');
    }
  }

  private async toggleSavedCommodity(commodityId: string): Promise<void> {
    if (this.savedActionPending) return;
    if (!isCommodityNodeAccountServiceConfigured()) {
      this.setSavedActionStatus(
        'Account watchlists are not available on this deployment.',
      );
      this.updateSavedAction();
      return;
    }
    if (!getAuthState().user) {
      this.setSavedActionStatus('Sign in to keep a watchlist across devices.');
      openSignIn();
      return;
    }
    const shouldSave = !this.savedCommodityIds.has(commodityId);
    this.savedActionPending = true;
    this.updateSavedAction(true);
    this.setSavedActionStatus(shouldSave ? 'Saving…' : 'Removing…');
    try {
      await setCommodityNodeEntitySaved('commodity', commodityId, shouldSave);
      if (shouldSave) this.savedCommodityIds.add(commodityId);
      else this.savedCommodityIds.delete(commodityId);
      this.savedStateAccountId = getAuthState().user?.id ?? null;
      this.setSavedActionStatus(shouldSave ? 'Saved across your signed-in devices.' : 'Removed from your watchlist.');
      trackCommodityNodeEvent(
        shouldSave ? 'watchlist_item_saved' : 'watchlist_item_removed',
        {
          routeType: 'live_application',
          placement: 'impact_universe_inspector',
          entityType: 'commodity',
        },
      );
    } catch {
      this.setSavedActionStatus('Could not update the watchlist. Try again.');
    } finally {
      this.savedActionPending = false;
      this.updateSavedAction();
    }
  }

  private updateSavedAction(disabled = false): void {
    const button = this.content.querySelector<HTMLButtonElement>('[data-universe-save]');
    if (!button) return;
    const commodityId = button.dataset.universeSave ?? '';
    const saved = this.savedCommodityIds.has(commodityId);
    button.disabled =
      disabled || !isCommodityNodeAccountServiceConfigured();
    button.setAttribute('aria-pressed', String(saved));
    button.textContent = saved ? 'Saved to watchlist' : 'Save commodity';
  }

  private setSavedActionStatus(message: string): void {
    const status = this.content.querySelector<HTMLElement>('[data-universe-action-status]');
    if (status) status.textContent = message;
  }

  private buildCopperEvidenceCase(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'cn-universe-case';
    section.setAttribute('aria-labelledby', 'cn-universe-case-title');
    const playback =
      COBRE_PANAMA_PLAYBACK_SNAPSHOTS[this.timelineIndex]
      ?? COBRE_PANAMA_PLAYBACK_SNAPSHOTS[COBRE_PANAMA_PLAYBACK_SNAPSHOTS.length - 1];

    const heading = document.createElement('div');
    heading.className = 'cn-universe-case-heading';
    const title = document.createElement('h4');
    title.id = 'cn-universe-case-title';
    title.textContent = 'Verified historical impact path';
    heading.append(
      title,
      textElement(
        'cn-universe-case-status',
        `REVIEWED RECONSTRUCTION · ${playback?.date ?? '2023-11-28'}`,
      ),
    );

    const summary = document.createElement('p');
    summary.className = 'cn-universe-case-summary';
    summary.textContent =
      'Cobre Panama left normal production and its export route was disrupted. The reviewed evidence supports a supply interruption; it does not isolate a copper-price effect.';

    const paths = findImpactPaths(
      COBRE_PANAMA_GRAPH_SNAPSHOT,
      COBRE_PANAMA_IMPACT_EVENT,
      'industry-copper-consuming',
      { maxHops: 3, now: COBRE_PANAMA_GRAPH_SNAPSHOT.createdAt },
    );
    const path = paths[0];
    const pathList = document.createElement('ol');
    pathList.className = 'cn-universe-evidence-path';
    if (path) {
      for (const [index, entityId] of path.entityIds.entries()) {
        const entity = COBRE_PANAMA_GRAPH_SNAPSHOT.entities.find(
          (candidate) => candidate.id === entityId,
        );
        if (!entity) continue;
        const item = document.createElement('li');
        item.appendChild(textElement('cn-universe-path-step', String(index + 1)));
        const copy = document.createElement('span');
        copy.append(
          textElement('cn-universe-path-name', entity.name),
          textElement('cn-universe-path-type', entity.type),
        );
        item.appendChild(copy);
        const edgeId = index > 0 ? path.edgeIds[index - 1] : null;
        if (edgeId) {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.universeEvidence = edgeId;
          button.setAttribute('aria-expanded', String(this.selectedEvidenceId === edgeId));
          button.textContent = 'Evidence';
          item.appendChild(button);
        }
        pathList.appendChild(item);
      }
    }

    const conditional = document.createElement('p');
    conditional.className = 'cn-universe-case-condition';
    conditional.textContent =
      'Downstream transmission remains conditional on inventories, substitution, replacement supply, and demand.';

    const branchTitle = document.createElement('h5');
    branchTitle.textContent = 'Operating and export branch';
    const branch = document.createElement('ul');
    branch.className = 'cn-universe-case-branch';
    const branchItems = [
      {
        name: 'First Quantum Minerals',
        role: 'Operator',
        edgeId: 'edge-fqm-operates-cobre',
      },
      {
        name: 'Punta Rincón port',
        role: 'Export route',
        edgeId: 'edge-cobre-ships-punta-rincon',
      },
    ];
    for (const item of branchItems) {
      const row = document.createElement('li');
      const copy = document.createElement('span');
      copy.append(
        textElement('cn-universe-path-name', item.name),
        textElement('cn-universe-path-type', item.role),
      );
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.universeEvidence = item.edgeId;
      button.setAttribute('aria-expanded', String(this.selectedEvidenceId === item.edgeId));
      button.textContent = 'Evidence';
      row.append(copy, button);
      branch.appendChild(row);
    }

    section.append(heading, summary, pathList, branchTitle, branch, conditional);
    const selectedEdge = COBRE_PANAMA_GRAPH_SNAPSHOT.edges.find(
      (edge) => edge.id === this.selectedEvidenceId,
    );
    if (selectedEdge) section.appendChild(this.buildEvidenceDrawer(selectedEdge));
    section.appendChild(this.buildCaseTimeline());

    const eventLink = document.createElement('a');
    eventLink.className = 'cn-universe-event-link';
    eventLink.href = 'https://commoditynode.com/events/cobre-panama-production-halt/';
    eventLink.target = '_blank';
    eventLink.rel = 'noopener';
    eventLink.textContent = 'Open the complete event record';
    section.appendChild(eventLink);
    return section;
  }

  private buildEvidenceDrawer(edge: PublishedImpactEdge): HTMLElement {
    const drawer = document.createElement('div');
    drawer.className = 'cn-universe-evidence-drawer';
    const relation = document.createElement('div');
    relation.className = 'cn-universe-evidence-relation';
    relation.append(
      textElement('cn-universe-eyebrow', 'EDGE EVIDENCE'),
      textElement(
        'cn-universe-evidence-title',
        edge.relationType.replace(/_/g, ' '),
      ),
    );
    const facts = document.createElement('dl');
    const entries: Array<readonly [string, string]> = [
      ['Direction', edge.direction],
      ['Confidence', edge.confidenceBand],
      [
        'Lag',
        edge.lagMinDays === undefined
          ? 'Not estimated'
          : `${edge.lagMinDays}–${edge.lagMaxDays ?? edge.lagMinDays} days`,
      ],
    ];
    for (const [term, value] of entries) {
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      dd.textContent = value;
      facts.append(dt, dd);
    }
    drawer.append(relation, facts);

    if (edge.condition) {
      const condition = document.createElement('p');
      condition.append(
        textElement('cn-universe-evidence-label', 'Condition'),
        document.createTextNode(edge.condition),
      );
      drawer.appendChild(condition);
    }
    if (edge.invalidation) {
      const invalidation = document.createElement('p');
      invalidation.append(
        textElement('cn-universe-evidence-label', 'Invalidation'),
        document.createTextNode(edge.invalidation),
      );
      drawer.appendChild(invalidation);
    }

    const sources = document.createElement('ul');
    sources.className = 'cn-universe-evidence-sources';
    for (const evidenceId of edge.evidenceIds) {
      const evidence = COBRE_PANAMA_GRAPH_SNAPSHOT.evidence.find(
        (candidate) => candidate.id === evidenceId,
      );
      if (!evidence) continue;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = evidence.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = evidence.publisher;
      const locator = document.createElement('p');
      locator.textContent = evidence.locator;
      item.append(link, locator);
      sources.appendChild(item);
    }
    drawer.appendChild(sources);
    return drawer;
  }

  private buildCaseTimeline(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'cn-universe-timeline';
    section.setAttribute('aria-label', 'Cobre Panama evidence timeline playback');
    const playback =
      COBRE_PANAMA_PLAYBACK_SNAPSHOTS[this.timelineIndex]
      ?? COBRE_PANAMA_PLAYBACK_SNAPSHOTS[0];

    const heading = document.createElement('div');
    heading.className = 'cn-universe-timeline-heading';
    heading.append(
      textElement('cn-universe-timeline-title', 'Evidence playback'),
      textElement(
        'cn-universe-timeline-position',
        `${this.timelineIndex + 1} / ${COBRE_PANAMA_PLAYBACK_SNAPSHOTS.length}`,
      ),
    );

    const controls = document.createElement('div');
    controls.className = 'cn-universe-timeline-controls';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.dataset.universeTimeline = 'previous';
    previous.disabled = this.timelineIndex === 0;
    previous.setAttribute('aria-label', 'Show previous evidence snapshot');
    previous.textContent = 'Previous';
    const state = document.createElement('div');
    state.className = 'cn-universe-timeline-state';
    state.setAttribute('aria-live', 'polite');
    const time = document.createElement('time');
    time.dateTime = playback?.date ?? '';
    time.textContent = playback?.date ?? 'Unknown date';
    state.append(
      time,
      textElement(
        'cn-universe-timeline-state-label',
        playback?.label ?? 'Evidence snapshot unavailable.',
      ),
    );
    const next = document.createElement('button');
    next.type = 'button';
    next.dataset.universeTimeline = 'next';
    next.disabled = this.timelineIndex === COBRE_PANAMA_PLAYBACK_SNAPSHOTS.length - 1;
    next.setAttribute('aria-label', 'Show next evidence snapshot');
    next.textContent = 'Next';
    controls.append(previous, state, next);

    const disclosure = document.createElement('p');
    disclosure.className = 'cn-universe-timeline-disclosure';
    disclosure.textContent =
      'Retrospective reconstruction prepared in 2026. Each step shows the reviewed evidence accumulated through that date, not a claim about what CommodityNode published at the time.';

    const list = document.createElement('ol');
    for (const [index, entry] of COBRE_PANAMA_TIMELINE.entries()) {
      const item = document.createElement('li');
      if (index === this.timelineIndex) {
        item.classList.add('is-active');
        item.setAttribute('aria-current', 'step');
      }
      const time = document.createElement('time');
      time.dateTime = entry.date;
      time.textContent = entry.date;
      item.append(time, document.createTextNode(entry.label));
      list.appendChild(item);
    }
    section.append(heading, controls, disclosure, list);
    return section;
  }
}
