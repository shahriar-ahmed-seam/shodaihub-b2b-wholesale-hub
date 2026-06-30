/**
 * Task 3.2 — Role gating matrix + rate limiting + body-size limit + request-shape validation.
 * Validates: Requirements 2.3, 2.4, 19.3
 *
 * Exercises the running gateway end-to-end (over ephemeral keys + fake upstreams) to confirm the
 * coarse role→route matrix returns 403 for disallowed roles, that public auth routes are rate
 * limited, that oversized bodies are rejected, and that malformed request shapes are rejected
 * before any upstream call.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { signToken, startApp, type TestApp } from './helpers.js';

let app: TestApp;

afterEach(async () => {
  if (app) await app.stop();
});

describe('Coarse role gating (Req 2.3)', () => {
  it('forbids a RETAILER from a supplier-only route with 403', async () => {
    app = await startApp();
    const token = signToken('ret-1', 'RETAILER');
    const res = await fetch(`${app.baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'x' }),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    // The request must NOT have reached the upstream.
    expect(app.upstreams.inventory.requests.length).toBe(0);
  });

  it('forbids a SUPPLIER from a retailer-only route (checkout) with 403', async () => {
    app = await startApp();
    const token = signToken('sup-1', 'SUPPLIER');
    const res = await fetch(`${app.baseUrl}/api/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
    expect(app.upstreams.inventory.requests.length).toBe(0);
  });

  it('forbids a non-admin from an admin-only route with 403', async () => {
    app = await startApp();
    const token = signToken('sup-1', 'SUPPLIER');
    const res = await fetch(`${app.baseUrl}/api/admin/metrics`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it('permits an ADMINISTRATOR to modify a supplier-owned resource (ownership re-checked in Inventory)', async () => {
    app = await startApp();
    const token = signToken('admin-1', 'ADMINISTRATOR');
    const res = await fetch(`${app.baseUrl}/api/products/p-1/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect(app.upstreams.inventory.lastRequest?.url).toBe('/products/p-1/publish');
  });
});

describe('Request-shape validation (Req 19.3)', () => {
  it('rejects a registration with missing fields (422) before reaching the upstream', async () => {
    app = await startApp();
    const res = await fetch(`${app.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.co' }),
    });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'INVALID_REQUEST_SHAPE',
    );
    expect(app.upstreams.auth.requests.length).toBe(0);
  });

  it('rejects a non-object JSON body on a write route (422)', async () => {
    app = await startApp();
    const res = await fetch(`${app.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(['not', 'an', 'object']),
    });
    expect(res.status).toBe(422);
  });

  it('rejects malformed JSON with 400', async () => {
    app = await startApp();
    const res = await fetch(`${app.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INVALID_JSON');
  });
});

describe('Request body-size limit (Req 19.3)', () => {
  it('rejects a body larger than the configured limit with 413', async () => {
    app = await startApp({ configOverrides: { bodyLimit: '100b' } });
    const big = 'x'.repeat(2000);
    const res = await fetch(`${app.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.co', password: big }),
    });
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('Rate limiting on auth routes (Req 2.4)', () => {
  it('returns 429 after exceeding the strict auth-route limit', async () => {
    app = await startApp({ configOverrides: { authRateLimitMax: 2, authRateLimitWindowMs: 60_000 } });
    app.upstreams.auth.setResponse({ status: 200, body: { ok: true } });

    const call = () =>
      fetch(`${app.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.co', password: 'secret123' }),
      });

    const first = await call();
    const second = await call();
    const third = await call();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(((await third.json()) as { error: { code: string } }).error.code).toBe('AUTH_RATE_LIMITED');
  });
});
