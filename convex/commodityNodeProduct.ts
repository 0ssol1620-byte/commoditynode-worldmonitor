import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUserId, resolveUserIdentity } from "./lib/auth";
import { CANONICAL_COMMODITYNODE_ALERT_EVENTS } from "./config/commodityNodeAlertCatalog";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_RE = /^[a-f0-9]{64}$/;
const ID_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const MAX_SAVED_ENTITIES = 100;
const MAX_ALERT_RULES = 50;
const AUDIT_RETENTION_MS = 7 * 365 * 24 * 60 * 60 * 1000;
const NEWSLETTER_PENDING_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const NEWSLETTER_WITHDRAWN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const BRIEF_REQUEST_RETENTION_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 200;

function clean(value: string, max: number): string {
  return value.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, max);
}

function normalizeEmail(value: string): string {
  const email = clean(value, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new ConvexError("VALID_EMAIL_REQUIRED");
  return email;
}

function validEntityId(value: string): string {
  const entityId = clean(value, 120).toLowerCase();
  if (!ID_RE.test(entityId)) throw new ConvexError("INVALID_ENTITY_ID");
  return entityId;
}

async function actorHash(userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`commoditynode-account-v1:${userId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const requestNewsletterSubscription = mutation({
  args: {
    email: v.string(),
    consentVersion: v.number(),
    consentedAt: v.number(),
    source: v.string(),
    confirmationTokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    if (args.consentVersion !== 1) throw new ConvexError("CONSENT_VERSION_REQUIRED");
    if (!TOKEN_RE.test(args.confirmationTokenHash)) throw new ConvexError("INVALID_CONFIRMATION_TOKEN");
    const now = Date.now();
    if (Math.abs(now - args.consentedAt) > 10 * 60 * 1000) {
      throw new ConvexError("INVALID_CONSENT_TIME");
    }
    const existing = await ctx.db
      .query("commodityNodeNewsletterSubscriptions")
      .withIndex("by_normalized_email", (q) => q.eq("normalizedEmail", normalizedEmail))
      .unique();
    if (existing?.status === "active") return { status: "already_active" as const };
    if (
      existing
      && now - existing.confirmationRequestedAt < 15 * 60 * 1000
      && existing.status === "pending"
    ) return { status: "pending" as const };

    const record = {
      email: clean(args.email, 254),
      normalizedEmail,
      status: "pending" as const,
      consentVersion: 1,
      consentedAt: args.consentedAt,
      source: clean(args.source, 64) || "research",
      confirmationTokenHash: args.confirmationTokenHash,
      confirmationRequestedAt: now,
      updatedAt: now,
      unsubscribedAt: undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, record);
    } else {
      await ctx.db.insert("commodityNodeNewsletterSubscriptions", {
        ...record,
        createdAt: now,
      });
    }
    return { status: "confirmation_required" as const };
  },
});

export const confirmNewsletterSubscription = mutation({
  args: { confirmationTokenHash: v.string() },
  handler: async (ctx, args) => {
    if (!TOKEN_RE.test(args.confirmationTokenHash)) throw new ConvexError("INVALID_CONFIRMATION_TOKEN");
    const record = await ctx.db
      .query("commodityNodeNewsletterSubscriptions")
      .withIndex("by_confirmation_hash", (q) =>
        q.eq("confirmationTokenHash", args.confirmationTokenHash),
      )
      .unique();
    if (!record || Date.now() - record.confirmationRequestedAt > 48 * 60 * 60 * 1000) {
      throw new ConvexError("CONFIRMATION_EXPIRED");
    }
    const now = Date.now();
    await ctx.db.patch(record._id, {
      status: "active",
      confirmedAt: now,
      updatedAt: now,
    });
    return { status: "active" as const };
  },
});

export const unsubscribeNewsletter = mutation({
  args: { confirmationTokenHash: v.string() },
  handler: async (ctx, args) => {
    if (!TOKEN_RE.test(args.confirmationTokenHash)) {
      throw new ConvexError("INVALID_UNSUBSCRIBE_TOKEN");
    }
    const record = await ctx.db
      .query("commodityNodeNewsletterSubscriptions")
      .withIndex("by_confirmation_hash", (q) =>
        q.eq("confirmationTokenHash", args.confirmationTokenHash),
      )
      .unique();
    if (!record) return { status: "not_found" as const };
    const now = Date.now();
    await ctx.db.patch(record._id, {
      status: "unsubscribed",
      email: "unsubscribed",
      normalizedEmail: `unsubscribed-${record._id}`,
      confirmationTokenHash: undefined,
      unsubscribedAt: now,
      updatedAt: now,
    });
    return { status: "unsubscribed" as const };
  },
});

/**
 * Roll back a confirmation request when the transactional email provider did
 * not accept the message. A compare-by-token delete cannot remove a newer
 * confirmation request created by a concurrent retry.
 */
export const cancelNewsletterConfirmation = mutation({
  args: { confirmationTokenHash: v.string() },
  handler: async (ctx, args) => {
    if (!TOKEN_RE.test(args.confirmationTokenHash)) {
      throw new ConvexError("INVALID_CONFIRMATION_TOKEN");
    }
    const record = await ctx.db
      .query("commodityNodeNewsletterSubscriptions")
      .withIndex("by_confirmation_hash", (q) =>
        q.eq("confirmationTokenHash", args.confirmationTokenHash),
      )
      .unique();
    if (!record || record.status !== "pending") return { removed: false };
    await ctx.db.delete(record._id);
    return { removed: true };
  },
});

export const submitBriefRequest = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    organization: v.string(),
    role: v.optional(v.string()),
    commodityIds: v.array(v.string()),
    decision: v.string(),
    timeframe: v.string(),
    consentVersion: v.number(),
    consentedAt: v.number(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    const now = Date.now();
    if (args.consentVersion !== 1 || Math.abs(now - args.consentedAt) > 10 * 60 * 1000) {
      throw new ConvexError("VALID_CONSENT_REQUIRED");
    }
    const recent = await ctx.db
      .query("commodityNodeBriefRequests")
      .withIndex("by_normalized_email_created", (q) =>
        q.eq("normalizedEmail", normalizedEmail).gte("createdAt", now - 24 * 60 * 60 * 1000),
      )
      .take(3);
    if (recent.length >= 2) throw new ConvexError("RATE_LIMITED");
    const name = clean(args.name, 120);
    const organization = clean(args.organization, 160);
    const decision = clean(args.decision, 1200);
    const timeframe = clean(args.timeframe, 120);
    if (!name || !organization || decision.length < 40 || !timeframe) {
      throw new ConvexError("INVALID_BRIEF_REQUEST");
    }
    const commodityIds = [...new Set(args.commodityIds.map(validEntityId))].slice(0, 12);
    if (commodityIds.length === 0) throw new ConvexError("COMMODITY_REQUIRED");
    const id = await ctx.db.insert("commodityNodeBriefRequests", {
      name,
      email: clean(args.email, 254),
      normalizedEmail,
      organization,
      role: args.role ? clean(args.role, 120) : undefined,
      commodityIds,
      decision,
      timeframe,
      consentVersion: 1,
      consentedAt: args.consentedAt,
      source: clean(args.source, 64) || "research",
      status: "new",
      createdAt: now,
      updatedAt: now,
    });
    return { status: "received" as const, requestId: id };
  },
});

export const listSavedEntities = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("commodityNodeSavedEntities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const saveEntity = mutation({
  args: {
    entityType: v.union(v.literal("commodity"), v.literal("company"), v.literal("route")),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const entityId = validEntityId(args.entityId);
    const existing = await ctx.db
      .query("commodityNodeSavedEntities")
      .withIndex("by_user_entity", (q) =>
        q.eq("userId", userId).eq("entityType", args.entityType).eq("entityId", entityId),
      )
      .unique();
    if (existing) return existing._id;
    const saved = await ctx.db
      .query("commodityNodeSavedEntities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_SAVED_ENTITIES);
    if (saved.length >= MAX_SAVED_ENTITIES) throw new ConvexError("SAVED_ENTITY_LIMIT");
    return ctx.db.insert("commodityNodeSavedEntities", {
      userId,
      entityType: args.entityType,
      entityId,
      createdAt: Date.now(),
    });
  },
});

export const removeSavedEntity = mutation({
  args: {
    entityType: v.union(v.literal("commodity"), v.literal("company"), v.literal("route")),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("commodityNodeSavedEntities")
      .withIndex("by_user_entity", (q) =>
        q.eq("userId", userId)
          .eq("entityType", args.entityType)
          .eq("entityId", validEntityId(args.entityId)),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return { removed: Boolean(existing) };
  },
});

export const listAlertRules = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("commodityNodeAlertRules")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const upsertAlertRule = mutation({
  args: {
    scopeType: v.union(
      v.literal("commodity"),
      v.literal("company"),
      v.literal("route"),
      v.literal("event_pulse"),
    ),
    scopeId: v.string(),
    channel: v.union(v.literal("email"), v.literal("in_app")),
    minimumMateriality: v.union(
      v.literal("notable"),
      v.literal("material"),
      v.literal("critical"),
    ),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const scopeId = validEntityId(args.scopeId);
    const existing = await ctx.db
      .query("commodityNodeAlertRules")
      .withIndex("by_user_scope", (q) =>
        q.eq("userId", userId).eq("scopeType", args.scopeType).eq("scopeId", scopeId),
      )
      .first();
    const now = Date.now();
    const update = {
      channel: args.channel,
      minimumMateriality: args.minimumMateriality,
      dedupeWindowMinutes: 360,
      enabled: args.enabled,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, update);
      return existing._id;
    }
    const rules = await ctx.db
      .query("commodityNodeAlertRules")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_ALERT_RULES);
    if (rules.length >= MAX_ALERT_RULES) throw new ConvexError("ALERT_RULE_LIMIT");
    return ctx.db.insert("commodityNodeAlertRules", {
      userId,
      scopeType: args.scopeType,
      scopeId,
      ...update,
      createdAt: now,
    });
  },
});

export const recordAlertDelivery = internalMutation({
  args: {
    userId: v.string(),
    ruleId: v.id("commodityNodeAlertRules"),
    eventFingerprint: v.string(),
    channel: v.union(v.literal("email"), v.literal("in_app")),
    alertEventId: v.id("commodityNodeAlertEvents"),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.userId !== args.userId || !rule.enabled) {
      return { recorded: false, reason: "rule_ineligible" as const };
    }
    const fingerprint = clean(args.eventFingerprint, 96);
    if (!/^cne_[a-f0-9]{8,64}$/.test(fingerprint)) {
      throw new ConvexError("INVALID_EVENT_FINGERPRINT");
    }
    const existing = await ctx.db
      .query("commodityNodeAlertDeliveries")
      .withIndex("by_rule_fingerprint", (q) =>
        q.eq("ruleId", args.ruleId).eq("eventFingerprint", fingerprint),
      )
      .unique();
    if (existing) return { recorded: false, reason: "duplicate" as const };
    await ctx.db.insert("commodityNodeAlertDeliveries", {
      userId: args.userId,
      ruleId: args.ruleId,
      eventFingerprint: fingerprint,
      alertEventId: args.alertEventId,
      channel: args.channel,
      deliveredAt: Date.now(),
    });
    return { recorded: true, reason: "first_delivery" as const };
  },
});

const MATERIALITY_RANK = {
  notable: 1,
  material: 2,
  critical: 3,
} as const;

/**
 * Idempotently projects the release-reviewed catalog into durable events and
 * creates in-app deliveries for rules that existed before each publication.
 * Callers cannot provide event content, so this public mutation is safe for a
 * Vercel cron without an admin credential.
 */
export const syncCanonicalAlertEvents = mutation({
  args: {},
  handler: async (ctx) => {
    let eventsInserted = 0;
    let deliveriesInserted = 0;
    for (const event of CANONICAL_COMMODITYNODE_ALERT_EVENTS) {
      let stored = await ctx.db
        .query("commodityNodeAlertEvents")
        .withIndex("by_fingerprint", (q) => q.eq("fingerprint", event.fingerprint))
        .unique();
      if (!stored) {
        const id = await ctx.db.insert("commodityNodeAlertEvents", {
          fingerprint: event.fingerprint,
          eventId: event.eventId,
          eventType: event.eventType,
          title: event.title,
          summary: event.summary,
          evidenceHref: event.evidenceHref,
          materiality: event.materiality,
          publishedAt: event.publishedAt,
          syncedAt: Date.now(),
        });
        stored = await ctx.db.get(id);
        eventsInserted += 1;
      }
      if (!stored) continue;

      for (const scope of event.scopes) {
        const rules = await ctx.db
          .query("commodityNodeAlertRules")
          .withIndex("by_scope_enabled", (q) =>
            q.eq("scopeType", scope.scopeType).eq("scopeId", scope.scopeId).eq("enabled", true),
          )
          .take(500);
        for (const rule of rules) {
          if (rule.createdAt > event.publishedAt) continue;
          if (
            MATERIALITY_RANK[event.materiality]
            < MATERIALITY_RANK[rule.minimumMateriality]
          ) continue;
          const existing = await ctx.db
            .query("commodityNodeAlertDeliveries")
            .withIndex("by_rule_fingerprint", (q) =>
              q.eq("ruleId", rule._id).eq("eventFingerprint", event.fingerprint),
            )
            .unique();
          if (existing) continue;
          await ctx.db.insert("commodityNodeAlertDeliveries", {
            userId: rule.userId,
            ruleId: rule._id,
            eventFingerprint: event.fingerprint,
            alertEventId: stored._id,
            channel: "in_app",
            deliveredAt: Date.now(),
          });
          deliveriesInserted += 1;
        }
      }
    }
    return { eventsInserted, deliveriesInserted };
  },
});

export const listAlertDeliveries = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const deliveries = await ctx.db
      .query("commodityNodeAlertDeliveries")
      .withIndex("by_user_delivered", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return Promise.all(
      deliveries.map(async (delivery) => ({
        ...delivery,
        event: await ctx.db.get(delivery.alertEventId),
      })),
    );
  },
});

export const markAlertDeliveriesRead = mutation({
  args: { deliveryIds: v.array(v.id("commodityNodeAlertDeliveries")) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    let updated = 0;
    for (const id of [...new Set(args.deliveryIds)].slice(0, 50)) {
      const delivery = await ctx.db.get(id);
      if (!delivery || delivery.userId !== userId || delivery.readAt) continue;
      await ctx.db.patch(id, { readAt: now });
      updated += 1;
    }
    return { updated };
  },
});

export const exportAccountData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const identity = await resolveUserIdentity(ctx);
    const [savedEntities, alertRules, alertDeliveries] = await Promise.all([
      ctx.db.query("commodityNodeSavedEntities").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("commodityNodeAlertRules").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("commodityNodeAlertDeliveries").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);
    const newsletter = identity?.email
      ? await ctx.db
          .query("commodityNodeNewsletterSubscriptions")
          .withIndex("by_normalized_email", (q) => q.eq("normalizedEmail", identity.email!.toLowerCase()))
          .unique()
      : null;
    const briefRequests = identity?.email
      ? await ctx.db
          .query("commodityNodeBriefRequests")
          .withIndex("by_normalized_email_created", (q) =>
            q.eq("normalizedEmail", identity.email!.toLowerCase()),
          )
          .collect()
      : [];
    const exportedAt = Date.now();
    const summary = JSON.stringify({
      savedEntities: savedEntities.length,
      alertRules: alertRules.length,
      alertDeliveries: alertDeliveries.length,
      newsletter: newsletter ? 1 : 0,
      briefRequests: briefRequests.length,
    });
    await ctx.db.insert("commodityNodePrivacyAudit", {
      actorHash: await actorHash(userId),
      action: "exported",
      summary,
      createdAt: exportedAt,
      retentionUntil: exportedAt + AUDIT_RETENTION_MS,
    });
    return {
      schemaVersion: 1,
      exportedAt: new Date(exportedAt).toISOString(),
      savedEntities,
      alertRules,
      alertDeliveries,
      newsletter,
      briefRequests,
    };
  },
});

export const deleteAccountData = mutation({
  args: { confirmation: v.literal("DELETE COMMODITYNODE DATA") },
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const identity = await resolveUserIdentity(ctx);
    const [savedEntities, alertRules, alertDeliveries] = await Promise.all([
      ctx.db.query("commodityNodeSavedEntities").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("commodityNodeAlertRules").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("commodityNodeAlertDeliveries").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);
    for (const record of alertDeliveries) await ctx.db.delete(record._id);
    for (const record of alertRules) await ctx.db.delete(record._id);
    for (const record of savedEntities) await ctx.db.delete(record._id);

    let newsletterUnsubscribed = false;
    let briefRequestsDeleted = 0;
    if (identity?.email) {
      const normalizedEmail = identity.email.toLowerCase();
      const newsletter = await ctx.db
        .query("commodityNodeNewsletterSubscriptions")
        .withIndex("by_normalized_email", (q) => q.eq("normalizedEmail", normalizedEmail))
        .unique();
      if (newsletter) {
        const now = Date.now();
        await ctx.db.patch(newsletter._id, {
          status: "unsubscribed",
          email: "deleted",
          normalizedEmail: `deleted-${newsletter._id}`,
          confirmationTokenHash: undefined,
          unsubscribedAt: now,
          updatedAt: now,
        });
        newsletterUnsubscribed = true;
      }
      const briefRequests = await ctx.db
        .query("commodityNodeBriefRequests")
        .withIndex("by_normalized_email_created", (q) =>
          q.eq("normalizedEmail", normalizedEmail),
        )
        .collect();
      for (const request of briefRequests) await ctx.db.delete(request._id);
      briefRequestsDeleted = briefRequests.length;
    }

    const now = Date.now();
    const summary = JSON.stringify({
      savedEntities: savedEntities.length,
      alertRules: alertRules.length,
      alertDeliveries: alertDeliveries.length,
      newsletterUnsubscribed,
      briefRequestsDeleted,
    });
    await ctx.db.insert("commodityNodePrivacyAudit", {
      actorHash: await actorHash(userId),
      action: "deleted",
      summary,
      createdAt: now,
      retentionUntil: now + AUDIT_RETENTION_MS,
    });
    return JSON.parse(summary) as {
      savedEntities: number;
      alertRules: number;
      alertDeliveries: number;
      newsletterUnsubscribed: boolean;
      briefRequestsDeleted: number;
    };
  },
});

/**
 * Bounded daily retention enforcement. Active newsletter subscriptions are
 * retained until withdrawal; abandoned confirmations, withdrawn addresses,
 * expired closed B2B requests, and expired pseudonymous audit rows are removed.
 */
export const pruneExpiredProductData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const subscriptions = await ctx.db
      .query("commodityNodeNewsletterSubscriptions")
      .take(CLEANUP_BATCH_SIZE);
    let newsletterDeleted = 0;
    for (const record of subscriptions) {
      const pendingExpired =
        record.status === "pending"
        && now - record.confirmationRequestedAt > NEWSLETTER_PENDING_RETENTION_MS;
      const withdrawnExpired =
        record.status === "unsubscribed"
        && now - (record.unsubscribedAt ?? record.updatedAt) > NEWSLETTER_WITHDRAWN_RETENTION_MS;
      if (pendingExpired || withdrawnExpired) {
        await ctx.db.delete(record._id);
        newsletterDeleted += 1;
      }
    }

    const briefRequests = await ctx.db
      .query("commodityNodeBriefRequests")
      .withIndex("by_created", (q) =>
        q.lt("createdAt", now - BRIEF_REQUEST_RETENTION_MS),
      )
      .take(CLEANUP_BATCH_SIZE);
    for (const record of briefRequests) await ctx.db.delete(record._id);

    const privacyAudit = await ctx.db
      .query("commodityNodePrivacyAudit")
      .withIndex("by_retention", (q) => q.lt("retentionUntil", now))
      .take(CLEANUP_BATCH_SIZE);
    for (const record of privacyAudit) await ctx.db.delete(record._id);

    return {
      newsletterDeleted,
      briefRequestsDeleted: briefRequests.length,
      privacyAuditDeleted: privacyAudit.length,
    };
  },
});
