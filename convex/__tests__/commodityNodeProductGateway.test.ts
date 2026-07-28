import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");
const GATEWAY_SECRET = "commoditynode-test-gateway-secret-32-bytes-minimum";

function request(operation: string, payload: Record<string, unknown>, secret = GATEWAY_SECRET) {
  return {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ operation, payload }),
  };
}

describe("/commoditynode/product authenticated lead gateway", () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.COMMODITYNODE_PRODUCT_GATEWAY_SECRET;
    process.env.COMMODITYNODE_PRODUCT_GATEWAY_SECRET = GATEWAY_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.COMMODITYNODE_PRODUCT_GATEWAY_SECRET;
    } else {
      process.env.COMMODITYNODE_PRODUCT_GATEWAY_SECRET = originalSecret;
    }
  });

  test("rejects missing or incorrect service credentials", async () => {
    const t = convexTest(schema, modules);
    const missing = await t.fetch("/commoditynode/product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "request_newsletter_subscription", payload: {} }),
    });
    const wrong = await t.fetch(
      "/commoditynode/product",
      request("request_newsletter_subscription", {}, "incorrect-gateway-secret"),
    );

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
  });

  test("rejects unsupported operations and non-object payloads", async () => {
    const t = convexTest(schema, modules);
    const unsupported = await t.fetch(
      "/commoditynode/product",
      request("delete_everything", {}),
    );
    const invalid = await t.fetch("/commoditynode/product", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GATEWAY_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operation: "request_newsletter_subscription",
        payload: [],
      }),
    });

    expect(unsupported.status).toBe(400);
    expect(await unsupported.json()).toEqual({ error: "UNSUPPORTED_OPERATION" });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "INVALID_REQUEST" });
  });

  test("persists newsletter consent only through the authenticated gateway", async () => {
    const t = convexTest(schema, modules);
    const response = await t.fetch(
      "/commoditynode/product",
      request("request_newsletter_subscription", {
        email: "gateway-reader@example.com",
        consentVersion: 1,
        consentedAt: Date.now(),
        source: "test",
        confirmationTokenHash: "a".repeat(64),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "confirmation_required" });
    await t.run(async (ctx) => {
      const records = await ctx.db
        .query("commodityNodeNewsletterSubscriptions")
        .collect();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        normalizedEmail: "gateway-reader@example.com",
        consentVersion: 1,
        status: "pending",
      });
    });
  });

  test("returns a generic failure without echoing invalid lead data", async () => {
    const t = convexTest(schema, modules);
    const response = await t.fetch(
      "/commoditynode/product",
      request("submit_brief_request", {
        name: "A",
        email: "private@example.com",
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "OPERATION_FAILED" });
  });
});
