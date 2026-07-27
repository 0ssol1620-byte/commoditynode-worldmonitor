import {
  isCommodityNodeSelection,
  resolveCommodityNodeSelection,
  type CommodityNodeSelection,
} from '@/config/commoditynode-selection';

const QUERY_KEY = 'mapEntity';

interface CommodityNodeMapSelectionEventDetail {
  entityId?: string | null;
  layerId?: string | null;
  selection?: unknown;
}

function createTextElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  text: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function isMobileSheet(): boolean {
  return window.matchMedia('(max-width: 720px)').matches;
}

export class CommodityMapDetailDrawer {
  private readonly root: HTMLElement;
  private readonly backdrop: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly typeLabel: HTMLElement;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly statusValue: HTMLElement;
  private readonly commodityRow: HTMLElement;
  private readonly commodityValue: HTMLElement;
  private readonly coordinatesRow: HTMLElement;
  private readonly coordinatesValue: HTMLElement;
  private readonly description: HTMLElement;
  private readonly sourceLabel: HTMLElement;
  private readonly researchLink: HTMLAnchorElement;
  private readonly eventLink: HTMLAnchorElement;
  private readonly mapButton: HTMLButtonElement;
  private readonly universeButton: HTMLButtonElement;
  private currentSelection: CommodityNodeSelection | null = null;
  private restoreFocusTo: HTMLElement | null = null;
  private readonly inertState = new Map<HTMLElement, boolean>();
  private destroyed = false;

  private readonly handleSelection = (event: Event): void => {
    const detail = (
      event as CustomEvent<CommodityNodeMapSelectionEventDetail>
    ).detail;
    const selection = isCommodityNodeSelection(detail?.selection)
      ? detail.selection
      : resolveCommodityNodeSelection(detail?.entityId, detail?.layerId);
    if (selection) this.open(selection);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !this.root.hidden) {
      event.preventDefault();
      this.close();
      return;
    }
    if (
      event.key === 'Tab'
      && !this.root.hidden
      && this.root.getAttribute('aria-modal') === 'true'
    ) {
      this.trapTabFocus(event);
    }
  };

  private readonly handlePopState = (): void => {
    this.openFromUrl(false);
  };

  constructor(container: HTMLElement = document.body) {
    this.backdrop = document.createElement('button');
    this.backdrop.type = 'button';
    this.backdrop.className = 'cn-map-detail-backdrop';
    this.backdrop.setAttribute('aria-label', 'Close map detail');
    this.backdrop.hidden = true;

    this.root = document.createElement('aside');
    this.root.className = 'cn-map-detail-drawer';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-labelledby', 'cn-map-detail-title');
    this.root.setAttribute('aria-describedby', 'cn-map-detail-description');
    this.root.hidden = true;

    const header = document.createElement('header');
    header.className = 'cn-map-detail-header';
    const headingGroup = document.createElement('div');
    this.typeLabel = createTextElement('p', 'cn-map-detail-type', 'Map detail');
    this.title = createTextElement('h2', 'cn-map-detail-title', 'Map selection');
    this.title.id = 'cn-map-detail-title';
    this.subtitle = createTextElement('p', 'cn-map-detail-subtitle', '');
    headingGroup.append(this.typeLabel, this.title, this.subtitle);
    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'cn-map-detail-close';
    this.closeButton.setAttribute('aria-label', 'Close map detail');
    this.closeButton.textContent = 'Close';
    header.append(headingGroup, this.closeButton);

    const facts = document.createElement('dl');
    facts.className = 'cn-map-detail-facts';
    const statusTerm = createTextElement('dt', '', 'Record status');
    this.statusValue = createTextElement('dd', '', '');
    this.commodityRow = document.createElement('div');
    this.commodityRow.append(
      createTextElement('dt', '', 'Commodity'),
      (this.commodityValue = createTextElement('dd', '', '')),
    );
    this.coordinatesRow = document.createElement('div');
    this.coordinatesRow.append(
      createTextElement('dt', '', 'Map position'),
      (this.coordinatesValue = createTextElement('dd', '', '')),
    );
    const statusRow = document.createElement('div');
    statusRow.append(statusTerm, this.statusValue);
    facts.append(statusRow, this.commodityRow, this.coordinatesRow);

    this.description = createTextElement(
      'p',
      'cn-map-detail-description',
      '',
    );
    this.description.id = 'cn-map-detail-description';

    const provenance = document.createElement('section');
    provenance.className = 'cn-map-detail-provenance';
    provenance.append(
      createTextElement('h3', '', 'Evidence state'),
      (this.sourceLabel = createTextElement('p', '', '')),
    );

    const actions = document.createElement('div');
    actions.className = 'cn-map-detail-actions';
    this.researchLink = document.createElement('a');
    this.researchLink.className = 'cn-map-detail-primary';
    this.eventLink = document.createElement('a');
    this.eventLink.className = 'cn-map-detail-secondary';
    this.mapButton = document.createElement('button');
    this.mapButton.type = 'button';
    this.mapButton.textContent = 'Center on map';
    this.universeButton = document.createElement('button');
    this.universeButton.type = 'button';
    this.universeButton.textContent = 'Open in Impact Universe';
    actions.append(
      this.researchLink,
      this.eventLink,
      this.mapButton,
      this.universeButton,
    );

    this.root.append(header, facts, this.description, provenance, actions);
    container.append(this.backdrop, this.root);

    this.backdrop.addEventListener('click', () => this.close());
    this.closeButton.addEventListener('click', () => this.close());
    this.mapButton.addEventListener('click', () => this.centerSelection());
    this.universeButton.addEventListener('click', () => this.openUniverse());
    window.addEventListener('commoditynode:map-selection', this.handleSelection);
    window.addEventListener('popstate', this.handlePopState);
    document.addEventListener('keydown', this.handleKeyDown);

    window.queueMicrotask(() => this.openFromUrl(false));
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('commoditynode:map-selection', this.handleSelection);
    window.removeEventListener('popstate', this.handlePopState);
    document.removeEventListener('keydown', this.handleKeyDown);
    this.setModalEnvironment(false);
    document.documentElement.classList.remove('cn-map-detail-sheet-open');
    this.root.remove();
    this.backdrop.remove();
  }

  private open(selection: CommodityNodeSelection, syncUrl = true): void {
    this.currentSelection = selection;
    this.restoreFocusTo =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.typeLabel.textContent = selection.typeLabel;
    this.title.textContent = selection.entityName;
    this.subtitle.textContent = selection.subtitle;
    this.statusValue.textContent = selection.statusLabel;
    this.description.textContent = selection.description;
    this.sourceLabel.textContent = selection.sourceLabel;

    this.commodityRow.hidden = !selection.commodityLabel;
    this.commodityValue.textContent = selection.commodityLabel ?? '';
    const hasCoordinates =
      selection.latitude !== null && selection.longitude !== null;
    this.coordinatesRow.hidden = !hasCoordinates;
    this.coordinatesValue.textContent = hasCoordinates
      ? `${selection.latitude!.toFixed(3)}, ${selection.longitude!.toFixed(3)}`
      : '';
    this.mapButton.hidden = !hasCoordinates;
    this.universeButton.hidden = !selection.commodityId;

    this.researchLink.href = selection.researchHref;
    this.researchLink.textContent = selection.researchLabel;
    this.eventLink.hidden = !selection.eventHref;
    this.eventLink.href = selection.eventHref ?? '/events/';
    this.eventLink.textContent = selection.eventLabel ?? 'Open Event Pulse';

    const mobile = isMobileSheet();
    this.root.setAttribute('aria-modal', mobile ? 'true' : 'false');
    this.root.dataset.kind = selection.kind;
    this.root.dataset.sourceStatus = selection.sourceStatus;
    this.root.hidden = false;
    this.backdrop.hidden = !mobile;
    this.setModalEnvironment(mobile);
    document.documentElement.classList.toggle('cn-map-detail-sheet-open', mobile);
    if (syncUrl) this.syncUrl(selection.entityId);
    window.requestAnimationFrame(() => this.closeButton.focus());
  }

  private close(syncUrl = true): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    this.backdrop.hidden = true;
    this.setModalEnvironment(false);
    document.documentElement.classList.remove('cn-map-detail-sheet-open');
    this.currentSelection = null;
    if (syncUrl) this.syncUrl(null);
    this.restoreFocusTo?.focus();
    this.restoreFocusTo = null;
  }

  private openFromUrl(syncUrl: boolean): void {
    const entityId = new URL(window.location.href).searchParams.get(QUERY_KEY);
    if (!entityId) {
      this.close(false);
      return;
    }
    const selection = resolveCommodityNodeSelection(entityId);
    if (selection) this.open(selection, syncUrl);
  }

  private syncUrl(entityId: string | null): void {
    const url = new URL(window.location.href);
    if (entityId) url.searchParams.set(QUERY_KEY, entityId);
    else url.searchParams.delete(QUERY_KEY);
    window.history.replaceState(window.history.state, '', url);
  }

  private centerSelection(): void {
    const selection = this.currentSelection;
    if (
      !selection
      || selection.latitude === null
      || selection.longitude === null
    ) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent('commoditynode:map-center-request', {
        detail: {
          latitude: selection.latitude,
          longitude: selection.longitude,
          layerId: selection.layerId,
        },
      }),
    );
  }

  private openUniverse(): void {
    const selection = this.currentSelection;
    if (!selection?.commodityId) return;
    window.dispatchEvent(
      new CustomEvent('commoditynode:universe-selection', {
        detail: {
          commodityId: selection.commodityId,
          source: 'map-detail-drawer',
        },
      }),
    );
    document
      .querySelector('[data-panel="impact-universe"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private setModalEnvironment(active: boolean): void {
    if (!active) {
      for (const [element, wasInert] of this.inertState) {
        element.inert = wasInert;
      }
      this.inertState.clear();
      return;
    }
    if (this.inertState.size > 0) return;
    for (const child of document.body.children) {
      if (
        !(child instanceof HTMLElement)
        || child === this.root
        || child === this.backdrop
      ) {
        continue;
      }
      this.inertState.set(child, child.inert);
      child.inert = true;
    }
  }

  private trapTabFocus(event: KeyboardEvent): void {
    const focusable = [
      ...this.root.querySelectorAll<HTMLElement>(
        'a[href]:not([hidden]), button:not([disabled]):not([hidden])',
      ),
    ].filter((element) => element.offsetParent !== null);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
