/**
 * Task 3.1 — BFF routing/proxy behaviour against fake upstreams.
 * Validates: Requirements 2.1, 20.2 (routing, header/body forwarding, upstream failure mapping)
 *
 * No real Auth/Inventory/Search/Payment services are required: each upstream is a tiny in-process
 * HTTP stand-in that records what it receives.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signToken, startApp, type TestApp } from './helpers.js';

let app: TestApp;

beforeEach(async () => {
  app = await startApp();
});

afterEach(async () => {
  await app.stop();
});

describe('Routing to the correct upstream service', () => {
  it('routes /api/search to the search service', async () => {
    const res = await fetch(`${app.baseUrl}/api/search?q=x`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { upstream: string };
    expect(body.upstream).toBe('search');
  });

  it('routes /api/products (supplier) to the inventory service', async () => {
    const token = signToken('sup-1', 'SUPPLIER');
    const res = await fetch(`${app.baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Rice', basePrice: '10.00', moq: 5, category: 'grains' }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { upstream: string }).upstream).toBe('inventory');
    expect(app.upstreams.inventory.lastRequest?.url).toBe('/products');
  });

  it('routes /api/payments/initiate (retailer) to the payment service', async () => {
    const token = signToken('ret-1', 'RETAILER');
    const res = await fetch(`${app.baseUrl}/api/payments/initiate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId: 'o-1', provider: 'bkash' }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { upstream: string }).upstream).toBe('payment');
  });
});

describe('Body + status forwarding', () => {
  it('forwards the request body verbatim to the upstream', async () => {
    const token = signToken('ret-1', 'RETAILER');
    const payload = { productId: 'p-1', quantity: 42 };
    await fetch(`${app.baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    expect(JSON.parse(app.upstreams.inventory.lastRequest!.body)).toEqual(payload);
  });

  it('relays the upstream status code and body to the client', async () => {
    app.upstreams.inventory.setResponse({ status: 409, body: { error: { code: 'MOQ_NOT_MET' } } });
    const token = signToken('ret-1', 'RETAILER');
    const res = await fetch(`${app.baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ productId: 'p-1', quantity: 1 }),
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('MOQ_NOT_MET');
  });
});

describe('Unknown routes return 404', () => {
  it('responds 404 for an unmapped path', async () => {
    const res = await fetch(`${app.baseUrl}/api/does/not/exist`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });
});

describe('Upstream failure mapping (design: HTTP Status Conventions)', () => {
  it('returns 502 when the upstream is unreachable', async () => {
    const down = await startApp({ startUpstreams: false });
    try {
      const res = await fetch(`${down.baseUrl}/api/search?q=x`);
      expect(res.status).toBe(502);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      await down.stop();
    }
  });

  it('returns 504 when the upstream exceeds the timeout', async () => {
    const slow = await startApp({ configOverrides: { upstreamTimeoutMs: 50 } });
    try {
      slow.upstreams.search.setResponse({ status: 200, body: { ok: true }, delayMs: 500 });
      const res = await fetch(`${slow.baseUrl}/api/search?q=x`);
      expect(res.status).toBe(504);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UPSTREAM_TIMEOUT');
    } finally {
      await slow.stop();
    }
  });
});
