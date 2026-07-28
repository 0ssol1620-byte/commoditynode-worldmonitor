import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");
const USER = {
  subject: "commoditynode-product-user",
  tokenIdentifier: "clerk|commoditynode-product-user",
  email: "reader@example.com",
};

const product = {
  requestNewsletterSubscription: makeFunctionReference<"mutation">(
    "commodityNodeProduct:requestNewsletterSubscription",
  ),
  cancelNewsletterConfirmation: makeFunctionReference<"mutation">(
    "commodityNodeProduct:cancelNewsletterConfirmation",
  ),
  unsubscribeNewsletter: makeFunctionReference<"mutation">(
    "commodityNodeProduct:unsubscribeNewsletter",
  ),
  submitBriefRequest: makeFunctionReference<"mutation">(
    "commodityNodeProduct:submitBriefRequest",
  ),
  listSavedEntities: makeFunctionReference<"query">(
    "commodityNodeProduct:listSavedEntities",
  ),
  saveEntity: makeFunctionReference<"mutation">("commodityNodeProduct:saveEntity"),
  removeSavedEntity: makeFunctionReference<"mutation">(
    "commodityNodeProduct:removeSavedEntity",
  ),
  listAlertRules: makeFunctionReference<"query">(
    "commodityNodeProduct:listAlertRules",
  ),
  syncCanonicalAlertEvents: makeFunctionReference<"mutation">(
    "commodityNodeProduct:syncCanonicalAlertEvents",
  ),
  listAlertDeliveries: makeFunctionReference<"query">(
    "commodityNodeProduct:listAlertDeliveries",
  ),
  markAlertDeliveriesRead: makeFunctionReference<"mutation">(
    "commodityNodeProduct:markAlertDeliveriesRead",
  ),
  upsertAlertRule: makeFunctionReference<"mutation">(
    "commodityNodeProduct:upsertAlertRule",
  ),
  exportAccountData: makeFunctionReference<"mutation">(
    "commodityNodeProduct:exportAccountData",
  ),
  deleteAccountData: makeFunctionReference<"mutation">(
    "commodityNodeProduct:deleteAccountData",
  ),
};

describe("CommodityNode account product primitives", () => {
  test("saved entities are authenticated, idempotent, and removable", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity(USER);

    await asUser.mutation(product.saveEntity, {
      entityType: "commodity",
      entityId: "copper",
    });
    await asUser.mutation(product.saveEntity, {
      entityType: "commodity",
      entityId: "copper",
    });
    expect(await asUser.query(product.listSavedEntities, {})).toHaveLength(1);

    await asUser.mutation(product.removeSavedEntity, {
      entityType: "commodity",
      entityId: "copper",
    });
    expect(await asUser.query(product.listSavedEntities, {})).toEqual([]);
  });

  test("alert rules update one durable rule per user and scope", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity(USER);
    const base = {
      scopeType: "commodity" as const,
      scopeId: "copper",
      channel: "in_app" as const,
      minimumMateriality: "material" as const,
    };
    await asUser.mutation(product.upsertAlertRule, { ...base, enabled: true });
    await asUser.mutation(product.upsertAlertRule, { ...base, enabled: false });

    const rules = await asUser.query(product.listAlertRules, {});
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ scopeId: "copper", enabled: false });
  });

  test("canonical alert sync is deduplicated and delivery read state is account-scoped", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity(USER);
    await t.run(async (ctx) => {
      await ctx.db.insert("commodityNodeAlertRules", {
        userId: USER.subject,
        scopeType: "event_pulse",
        scopeId: "cobre-panama-production-halt",
        channel: "in_app",
        minimumMateriality: "material",
        dedupeWindowMinutes: 360,
        enabled: true,
        createdAt: Date.UTC(2023, 0, 1),
        updatedAt: Date.UTC(2023, 0, 1),
      });
    });
    expect(await t.mutation(product.syncCanonicalAlertEvents, {})).toEqual({
      eventsInserted: 1,
      deliveriesInserted: 1,
    });
    expect(await t.mutation(product.syncCanonicalAlertEvents, {})).toEqual({
      eventsInserted: 0,
      deliveriesInserted: 0,
    });

    const deliveries = await asUser.query(product.listAlertDeliveries, {});
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.event?.title).toContain("Cobre Panama");
    await asUser.mutation(product.markAlertDeliveriesRead, {
      deliveryIds: [deliveries[0]._id],
    });
    expect((await asUser.query(product.listAlertDeliveries, {}))[0]?.readAt).toBeTypeOf("number");
  });

  test("failed confirmation delivery can roll back only its pending token", async () => {
    const t = convexTest(schema, modules);
    const token = "a".repeat(64);
    await t.mutation(product.requestNewsletterSubscription, {
      email: "reader@example.com",
      consentVersion: 1,
      consentedAt: Date.now(),
      source: "test",
      confirmationTokenHash: token,
    });
    expect(
      await t.mutation(product.cancelNewsletterConfirmation, {
        confirmationTokenHash: "b".repeat(64),
      }),
    ).toEqual({ removed: false });
    expect(
      await t.mutation(product.cancelNewsletterConfirmation, {
        confirmationTokenHash: token,
      }),
    ).toEqual({ removed: true });
  });

  test("unsubscribe immediately removes the address and is idempotent", async () => {
    const t = convexTest(schema, modules);
    const token = "d".repeat(64);
    await t.mutation(product.requestNewsletterSubscription, {
      email: "unsubscribe@example.com",
      consentVersion: 1,
      consentedAt: Date.now(),
      source: "test",
      confirmationTokenHash: token,
    });
    expect(
      await t.mutation(product.unsubscribeNewsletter, {
        confirmationTokenHash: token,
      }),
    ).toEqual({ status: "unsubscribed" });
    expect(
      await t.mutation(product.unsubscribeNewsletter, {
        confirmationTokenHash: token,
      }),
    ).toEqual({ status: "not_found" });
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("commodityNodeNewsletterSubscriptions").collect();
      expect(rows[0]?.email).toBe("unsubscribed");
      expect(rows[0]?.normalizedEmail).not.toContain("@");
    });
  });

  test("account export is audited and deletion covers account-linked leads", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity(USER);
    await asUser.mutation(product.saveEntity, {
      entityType: "commodity",
      entityId: "copper",
    });
    await t.mutation(product.requestNewsletterSubscription, {
      email: USER.email,
      consentVersion: 1,
      consentedAt: Date.now(),
      source: "test",
      confirmationTokenHash: "c".repeat(64),
    });
    await t.mutation(product.submitBriefRequest, {
      name: "Test Reader",
      email: USER.email,
      organization: "Example Operations",
      commodityIds: ["copper"],
      decision: "Assess physical copper supply exposure before the sourcing review.",
      timeframe: "Before the next quarterly sourcing review",
      consentVersion: 1,
      consentedAt: Date.now(),
      source: "test",
    });

    const exported = await asUser.mutation(product.exportAccountData, {});
    expect(exported.savedEntities).toHaveLength(1);
    expect(exported.briefRequests).toHaveLength(1);
    const deleted = await asUser.mutation(product.deleteAccountData, {
      confirmation: "DELETE COMMODITYNODE DATA",
    });
    expect(deleted).toMatchObject({
      savedEntities: 1,
      newsletterUnsubscribed: true,
      briefRequestsDeleted: 1,
    });

    await t.run(async (ctx) => {
      const audits = await ctx.db.query("commodityNodePrivacyAudit").collect();
      expect(audits.map((entry) => entry.action).sort()).toEqual(["deleted", "exported"]);
      expect(await ctx.db.query("commodityNodeBriefRequests").collect()).toEqual([]);
    });
  });
});
