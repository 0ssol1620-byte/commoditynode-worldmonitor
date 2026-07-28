import { ConvexHttpClient } from 'convex/browser';

export const config = { runtime: 'edge' };

function json(value: unknown, status: number): Response {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return json({ error: 'unauthorized' }, 401);
  }
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) return json({ error: 'alert_sync_unavailable' }, 503);
  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.mutation(
      'commodityNodeProduct:syncCanonicalAlertEvents' as never,
      {} as never,
    );
    return json({ status: 'ok', result }, 200);
  } catch {
    return json({ error: 'alert_sync_failed' }, 503);
  }
}
