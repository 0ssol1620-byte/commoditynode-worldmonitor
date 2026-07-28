# CommodityNode product data and lead operations

This runbook is the operational contract for newsletter signup, custom brief
requests, saved entities, alert rules, and account privacy actions.

## Required production configuration

The following variables must exist in the Live/API Vercel project before lead
workflows are advertised as available:

- `CONVEX_URL`: production Convex HTTP endpoint.
- `VITE_CONVEX_URL`: the same production deployment for signed-in browser calls.
- `RESEND_API_KEY`: restricted transactional-email key.
- `COMMODITYNODE_RESEND_FROM`: a sender on a Resend-verified CommodityNode domain.
- `COMMODITYNODE_LEADS_TO`: the private operations mailbox for custom brief notices.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: distributed rate limits.

Do not reuse a WorldMonitor sender identity. If any dependency is absent,
newsletter signup fails with `503`; custom brief intake fails with `503`. A
custom brief that is already durably stored still returns `202` if only the
operations notification is delayed, preventing duplicate customer submissions.

## Newsletter contract

- The browser must submit explicit consent version 1.
- The public endpoint rate limit is five requests per hour per privacy-preserving
  network bucket.
- Confirmation tokens contain 256 bits of randomness; Convex stores only SHA-256.
- Confirmation expires after 48 hours.
- A failed Resend acceptance rolls back only the matching pending token.
- An unfinished confirmation is pruned after 30 days.
- The confirmation message includes the durable unsubscribe link.
- Unsubscribe immediately removes the email address and token. The anonymous
  withdrawal marker is pruned after 30 days.

## Custom brief contract

- Required fields are name, valid email, organization, one approved commodity,
  at least 40 characters of decision context, timeframe, and consent version 1.
- Free text is control-character stripped and length bounded.
- Honeypot submissions receive a neutral accepted response and are not stored.
- The edge endpoint allows three attempts per hour; Convex independently allows
  at most two stored requests per email in 24 hours.
- Records are pruned after two years regardless of workflow status.
- The request page is `noindex,follow`, excluded from the sitemap, and never ad
  eligible.

## Saved entities and alerts

- Every query and mutation requires a valid Clerk identity at Convex.
- Saved entities are unique by account, entity type, and canonical entity ID;
  each account is capped at 100.
- Alert rules are unique by account and scope and capped at 50.
- Delivery records are unique by rule and canonical event fingerprint.
- UI success is shown only after the authoritative mutation resolves.

## Export, deletion, and retention audit

Live Settings exposes JSON export and deletion. Export writes a pseudonymous
audit record containing counts only. Deletion requires a typed phrase plus a
second confirmation and removes saved entities, alert rules, alert deliveries,
matching custom brief requests, and the account-email link in newsletter data.
It does not delete the external identity-provider account.

Audit actor IDs are SHA-256 pseudonyms of high-entropy Clerk subjects with a
CommodityNode namespace. Export/deletion audit rows are retained for seven years
and removed by the daily bounded retention job. The audit never contains deleted
record content, email, or free text.

## Release checks

Before enabling the forms:

1. Deploy Convex schema/functions and confirm the retention cron appears.
2. Verify the Resend sending domain, SPF, DKIM, and DMARC.
3. Submit a synthetic newsletter address and complete confirmation.
4. Use the received link to unsubscribe and verify address anonymization.
5. Submit one synthetic custom brief and verify both durable storage and mailbox delivery.
6. Sign in, save/remove one commodity, export JSON, then delete synthetic account data.
7. Review rate-limit counters and logs without printing addresses or tokens.
