import {
  isCommodityNodeSelection,
  resolveCommodityNodeSelection,
  type CommodityNodeSelection,
} from '@/config/commoditynode-selection';
import { getAuthState } from '@/services/auth-state';
import { openSignIn } from '@/services/clerk';
import {
  listCommodityNodeSavedEntities,
  listCommodityNodeAlertRules,
  setCommodityNodeAlertRule,
  setCommodityNodeEntitySaved,
  type CommodityNodeEntityType,
} from '@/services/commoditynode-product';
import { trackCommodityNodeEvent } from '@/services/commoditynode-analytics';

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
  private readonly saveButton: HTMLButtonElement;
  private readonly saveStatus: HTMLElement;
  private readonly alertButton: HTMLButtonElement;
  private readonly alertStatus: HTMLElement;
  private currentSelection: CommodityNodeSelection | null = null;
  private savedKeys = new Set<string>();
  private savedAccountId: string | null = null;
  private savePending = false;
  private alertKeys = new Set<string>();
  private alertAccountId: string | null = null;
  private alertPending = false;
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
    this.saveButton = document.createElement('button');
    this.saveButton.type = 'button';
    this.saveButton.className = 'cn-map-detail-save';
    this.saveButton.textContent = 'Save item';
    this.alertButton = document.createElement('button');
    this.alertButton.type = 'button';
    this.alertButton.className = 'cn-map-detail-alert';
    this.alertButton.textContent = 'Enable impact alert';
    actions.append(
      this.researchLink,
      this.eventLink,
      this.mapButton,
      this.universeButton,
      this.saveButton,
      this.alertButton,
    );
    this.saveStatus = createTextElement('p', 'cn-map-detail-save-status', '');
    this.saveStatus.setAttribute('role', 'status');
    this.saveStatus.setAttribute('aria-live', 'polite');
    this.alertStatus = createTextElement('p', 'cn-map-detail-alert-status', '');
    this.alertStatus.setAttribute('role', 'status');
    this.alertStatus.setAttribute('aria-live', 'polite');

    this.root.append(
      header,
      facts,
      this.description,
      provenance,
      actions,
      this.saveStatus,
      this.alertStatus,
    );
    container.append(this.backdrop, this.root);

    this.backdrop.addEventListener('click', () => this.close());
    this.closeButton.addEventListener('click', () => this.close());
    this.mapButton.addEventListener('click', () => this.centerSelection());
    this.universeButton.addEventListener('click', () => this.openUniverse());
    this.saveButton.addEventListener('click', () => void this.toggleSavedSelection());
    this.alertButton.addEventListener('click', () => void this.toggleAlertSelection());
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
    const saveTarget = this.savedTarget(selection);
    this.saveButton.hidden = !saveTarget;
    this.saveStatus.textContent = '';
    this.updateSaveButton();
    if (saveTarget) void this.hydrateSavedItems();
    const alertTarget = this.alertTarget(selection);
    this.alertButton.hidden = !alertTarget;
    this.alertStatus.textContent = '';
    this.updateAlertButton();
    if (alertTarget) void this.hydrateAlertRules();

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

  private savedTarget(
    selection = this.currentSelection,
  ): { entityType: CommodityNodeEntityType; entityId: string } | null {
    if (!selection) return null;
    if (
      selection.kind !== 'commodity'
      && selection.kind !== 'company'
      && selection.kind !== 'route'
    ) return null;
    const entityType = selection.kind;
    const entityId = selection.entityId.includes(':')
      ? selection.entityId.slice(selection.entityId.indexOf(':') + 1)
      : selection.entityId;
    return { entityType, entityId };
  }

  private savedKey(target: {
    entityType: CommodityNodeEntityType;
    entityId: string;
  }): string {
    return `${target.entityType}:${target.entityId}`;
  }

  private async hydrateSavedItems(): Promise<void> {
    const accountId = getAuthState().user?.id ?? null;
    if (!accountId) {
      this.savedKeys.clear();
      this.savedAccountId = null;
      this.updateSaveButton();
      return;
    }
    if (this.savedAccountId === accountId) {
      this.updateSaveButton();
      return;
    }
    try {
      const saved = await listCommodityNodeSavedEntities();
      if (getAuthState().user?.id !== accountId) return;
      this.savedKeys = new Set(
        saved.map((item) => `${item.entityType}:${item.entityId}`),
      );
      this.savedAccountId = accountId;
      this.updateSaveButton();
    } catch {
      this.saveStatus.textContent = 'Saved items are unavailable right now.';
    }
  }

  private async toggleSavedSelection(): Promise<void> {
    const target = this.savedTarget();
    if (!target || this.savePending) return;
    if (!getAuthState().user) {
      this.saveStatus.textContent = 'Sign in to save this item across devices.';
      openSignIn();
      return;
    }
    const key = this.savedKey(target);
    const shouldSave = !this.savedKeys.has(key);
    this.savePending = true;
    this.updateSaveButton();
    this.saveStatus.textContent = shouldSave ? 'Saving…' : 'Removing…';
    try {
      await setCommodityNodeEntitySaved(target.entityType, target.entityId, shouldSave);
      if (shouldSave) this.savedKeys.add(key);
      else this.savedKeys.delete(key);
      this.savedAccountId = getAuthState().user?.id ?? null;
      this.saveStatus.textContent = shouldSave
        ? 'Saved across your signed-in devices.'
        : 'Removed from saved items.';
      trackCommodityNodeEvent(
        shouldSave ? 'watchlist_item_saved' : 'watchlist_item_removed',
        {
          routeType: 'live_application',
          placement: 'map_detail_drawer',
          entityType: target.entityType,
        },
      );
    } catch {
      this.saveStatus.textContent = 'Could not update saved items. Try again.';
    } finally {
      this.savePending = false;
      this.updateSaveButton();
    }
  }

  private updateSaveButton(): void {
    const target = this.savedTarget();
    if (!target) return;
    const saved = this.savedKeys.has(this.savedKey(target));
    this.saveButton.disabled = this.savePending;
    this.saveButton.setAttribute('aria-pressed', String(saved));
    this.saveButton.textContent = saved ? 'Saved item' : 'Save item';
  }

  private alertTarget(
    selection = this.currentSelection,
  ): { scopeType: 'event_pulse' | 'route'; scopeId: string } | null {
    if (!selection || (selection.kind !== 'event' && selection.kind !== 'route')) {
      return null;
    }
    const scopeId = selection.entityId.includes(':')
      ? selection.entityId.slice(selection.entityId.indexOf(':') + 1)
      : selection.entityId;
    return {
      scopeType: selection.kind === 'event' ? 'event_pulse' : 'route',
      scopeId,
    };
  }

  private alertKey(target: {
    scopeType: 'event_pulse' | 'route';
    scopeId: string;
  }): string {
    return `${target.scopeType}:${target.scopeId}`;
  }

  private async hydrateAlertRules(): Promise<void> {
    const accountId = getAuthState().user?.id ?? null;
    if (!accountId) {
      this.alertKeys.clear();
      this.alertAccountId = null;
      this.updateAlertButton();
      return;
    }
    if (this.alertAccountId === accountId) {
      this.updateAlertButton();
      return;
    }
    try {
      const rules = await listCommodityNodeAlertRules();
      if (getAuthState().user?.id !== accountId) return;
      this.alertKeys = new Set(
        rules
          .filter((rule) => rule.enabled)
          .map((rule) => `${rule.scopeType}:${rule.scopeId}`),
      );
      this.alertAccountId = accountId;
      this.updateAlertButton();
    } catch {
      this.alertStatus.textContent = 'Alert rules are unavailable right now.';
    }
  }

  private async toggleAlertSelection(): Promise<void> {
    const target = this.alertTarget();
    if (!target || this.alertPending) return;
    if (!getAuthState().user) {
      this.alertStatus.textContent = 'Sign in to create an in-app impact alert.';
      openSignIn();
      return;
    }
    const key = this.alertKey(target);
    const enabled = !this.alertKeys.has(key);
    this.alertPending = true;
    this.updateAlertButton();
    this.alertStatus.textContent = enabled ? 'Creating alert…' : 'Disabling alert…';
    try {
      await setCommodityNodeAlertRule({
        ...target,
        channel: 'in_app',
        minimumMateriality: 'material',
        enabled,
      });
      if (enabled) this.alertKeys.add(key);
      else this.alertKeys.delete(key);
      this.alertAccountId = getAuthState().user?.id ?? null;
      this.alertStatus.textContent = enabled
        ? 'Alert enabled for new verified material updates.'
        : 'Alert disabled.';
      if (enabled) {
        trackCommodityNodeEvent('alert_created', {
          routeType: 'live_application',
          placement: 'map_detail_drawer',
          entityType: target.scopeType === 'route' ? 'route' : 'event',
        });
      }
    } catch {
      this.alertStatus.textContent = 'Could not update the alert. Try again.';
    } finally {
      this.alertPending = false;
      this.updateAlertButton();
    }
  }

  private updateAlertButton(): void {
    const target = this.alertTarget();
    if (!target) return;
    const enabled = this.alertKeys.has(this.alertKey(target));
    this.alertButton.disabled = this.alertPending;
    this.alertButton.setAttribute('aria-pressed', String(enabled));
    this.alertButton.textContent = enabled ? 'Impact alert enabled' : 'Enable impact alert';
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
