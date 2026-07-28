import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import analyticsHandler from '../api/commoditynode-analytics';
import {
  commodityNodeAnalyticsAggregateKey,
  parseCommodityNodeAnalyticsPayload,
} from '../shared/commoditynode-analytics';
import {
  createCommodityNodeConsent,
  parseCommodityNodeConsent,
} from '../shared/commoditynode-privacy';

describe('CommodityNode privacy-aware analytics', () => {
  it('round-trips a versioned, explicit consent record', () => {
    const consent = createCommodityNodeConsent(
      { analytics: true, advertising: false, source: 'settings' },
      '2026-07-28T08:00:00.000Z',
    );
    assert.deepEqual(parseCommodityNodeConsent(JSON.stringify(consent)), consent);
    assert.equal(parseCommodityNodeConsent('{"analytics":true}'), null);
    assert.equal(parseCommodityNodeConsent('not-json'), null);
  });

  it('accepts only bounded, low-cardinality analytics dimensions', () => {
    const payload = parseCommodityNodeAnalyticsPayload({
      version: 1,
      event: 'newsletter_signup_submitted',
      surface: 'research',
      routeType: 'research_article',
      placement: 'article_end',
      conversion: 'newsletter',
    });
    assert.ok(payload);
    assert.equal(
      commodityNodeAnalyticsAggregateKey(payload, '2026-07-28'),
      'commoditynode:analytics:v1:2026-07-28:research:newsletter_signup_submitted:research_article:article_end:none:newsletter',
    );

    for (const invalid of [
      { version: 1, event: 'email_entered', surface: 'research', routeType: 'home' },
      { version: 1, event: 'page_view', surface: 'research', routeType: 'post?id=private' },
      {
        version: 1,
        event: 'page_view',
        surface: 'research',
        routeType: 'home',
        placement: 'x'.repeat(100),
      },
      {
        version: 1,
        event: 'page_view',
        surface: 'research',
        routeType: 'home',
        email: 'person@example.com',
      },
    ]) {
      const parsed = parseCommodityNodeAnalyticsPayload(invalid);
      if ('email' in invalid) {
        assert.ok(parsed, 'unknown fields are discarded rather than persisted');
        assert.equal('email' in parsed, false);
      } else {
        assert.equal(parsed, null);
      }
    }
  });

  it('rejects cross-origin, malformed and oversized ingestion requests', async () => {
    const crossOrigin = await analyticsHandler(new Request(
      'https://commoditynode.com/api/commoditynode-analytics',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://commoditynode.com.evil.example',
        },
        body: '{}',
      },
    ));
    assert.equal(crossOrigin.status, 403);

    const malformed = await analyticsHandler(new Request(
      'https://commoditynode.com/api/commoditynode-analytics',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://commoditynode.com',
        },
        body: '{"event":',
      },
    ));
    assert.equal(malformed.status, 400);

    const oversized = await analyticsHandler(new Request(
      'https://commoditynode.com/api/commoditynode-analytics',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://commoditynode.com',
        },
        body: JSON.stringify({ padding: 'x'.repeat(2_100) }),
      },
    ));
    assert.equal(oversized.status, 413);
  });

  it('fails closed when aggregate storage is not configured', async () => {
    const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
    const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    try {
      const result = await analyticsHandler(new Request(
        'https://commoditynode.com/api/commoditynode-analytics',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'https://live.commoditynode.com',
          },
          body: JSON.stringify({
            version: 1,
            event: 'page_view',
            surface: 'live',
            routeType: 'live_application',
          }),
        },
      ));
      assert.equal(result.status, 503);
      assert.equal(result.headers.get('access-control-allow-origin'), 'https://live.commoditynode.com');
    } finally {
      if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
      else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
      if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
      else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
    }
  });
});

