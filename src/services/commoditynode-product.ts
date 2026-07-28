import { getAuthState } from './auth-state';
import { getConvexApi, getConvexClient, waitForConvexAuth } from './convex-client';

export type CommodityNodeEntityType = 'commodity' | 'company' | 'route';

export interface CommodityNodeSavedEntity {
  _id: string;
  entityType: CommodityNodeEntityType;
  entityId: string;
  createdAt: number;
}

export interface CommodityNodeAlertRule {
  _id: string;
  scopeType: CommodityNodeEntityType | 'event_pulse';
  scopeId: string;
  channel: 'in_app';
  minimumMateriality: 'notable' | 'material' | 'critical';
  enabled: boolean;
  updatedAt: number;
}

export interface CommodityNodeAlertDelivery {
  _id: string;
  deliveredAt: number;
  readAt?: number;
  event: {
    title: string;
    summary: string;
    evidenceHref: string;
    materiality: 'notable' | 'material' | 'critical';
    publishedAt: number;
  } | null;
}

export function hasCommodityNodeAccountService(config: {
  convexUrl?: string;
  clerkPublishableKey?: string;
}): boolean {
  return Boolean(config.convexUrl?.trim() && config.clerkPublishableKey?.trim());
}

export function isCommodityNodeAccountServiceConfigured(): boolean {
  const env = (
    import.meta as ImportMeta & {
      env?: {
        VITE_CONVEX_URL?: string;
        VITE_CLERK_PUBLISHABLE_KEY?: string;
      };
    }
  ).env;
  return hasCommodityNodeAccountService({
    convexUrl: env?.VITE_CONVEX_URL,
    clerkPublishableKey: env?.VITE_CLERK_PUBLISHABLE_KEY,
  });
}

async function authenticatedClient() {
  if (!isCommodityNodeAccountServiceConfigured()) {
    throw new Error('ACCOUNT_SERVICE_UNAVAILABLE');
  }
  if (!getAuthState().user) throw new Error('SIGN_IN_REQUIRED');
  const [client, api] = await Promise.all([getConvexClient(), getConvexApi()]);
  if (!client || !api) throw new Error('ACCOUNT_SERVICE_UNAVAILABLE');
  if (!(await waitForConvexAuth())) throw new Error('ACCOUNT_SESSION_UNAVAILABLE');
  return { client, productApi: (api as any).commodityNodeProduct };
}

export async function listCommodityNodeSavedEntities(): Promise<CommodityNodeSavedEntity[]> {
  const { client, productApi } = await authenticatedClient();
  return client.query(productApi.listSavedEntities, {});
}

export async function setCommodityNodeEntitySaved(
  entityType: CommodityNodeEntityType,
  entityId: string,
  saved: boolean,
): Promise<void> {
  const { client, productApi } = await authenticatedClient();
  if (saved) {
    await client.mutation(productApi.saveEntity, { entityType, entityId });
  } else {
    await client.mutation(productApi.removeSavedEntity, { entityType, entityId });
  }
}

export async function listCommodityNodeAlertRules(): Promise<CommodityNodeAlertRule[]> {
  const { client, productApi } = await authenticatedClient();
  return client.query(productApi.listAlertRules, {});
}

export async function setCommodityNodeAlertRule(input: {
  scopeType: CommodityNodeAlertRule['scopeType'];
  scopeId: string;
  channel: CommodityNodeAlertRule['channel'];
  minimumMateriality: CommodityNodeAlertRule['minimumMateriality'];
  enabled: boolean;
}): Promise<void> {
  const { client, productApi } = await authenticatedClient();
  await client.mutation(productApi.upsertAlertRule, input);
}

export async function listCommodityNodeAlertDeliveries(): Promise<
  CommodityNodeAlertDelivery[]
> {
  const { client, productApi } = await authenticatedClient();
  return client.query(productApi.listAlertDeliveries, {});
}

export async function markCommodityNodeAlertDeliveriesRead(
  deliveryIds: string[],
): Promise<void> {
  const { client, productApi } = await authenticatedClient();
  await client.mutation(productApi.markAlertDeliveriesRead, { deliveryIds });
}

export async function exportCommodityNodeAccountData(): Promise<unknown> {
  const { client, productApi } = await authenticatedClient();
  return client.mutation(productApi.exportAccountData, {});
}

export async function deleteCommodityNodeAccountData(): Promise<unknown> {
  const { client, productApi } = await authenticatedClient();
  return client.mutation(productApi.deleteAccountData, {
    confirmation: 'DELETE COMMODITYNODE DATA',
  });
}
