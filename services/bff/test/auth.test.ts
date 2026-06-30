/**
 * Task 3.1 — BFF JWT verification + public-route bypass + identity forwarding.
 * Validates: Requirements 2.1, 2.2, 20.2, 19.2
 *
 * Exercises the running gateway (over ephemeral keys + fake upstreams) to confirm it verifies the
 * RS256 JWT once, rejects missing/invalid/expired tokens with 401, lets public routes through
 * without a token, and forwards the resolved identity + correlation id to the upstream service.
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

describe('Public routes bypass authentication (Req: login/register/refresh/search/health)', () => {
  it('GET /health responds without a token', async () => {
    const res = await fetch(`${app.baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('bff');
  });

  it('POST /api/auth/login is proxied without a token', async () => {
    app.upstreams.auth.setResponse({ status: 200, body: { token: 'x' } });
    const res = await fetch(`${app.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.co', password: 'secret123' }),
    });
    expect(res.status).toBe(200);
    expect(app.upstreams.auth.lastRequest?.url).toBe('/auth/login');
    // No identity headers forwarded for a public route.
    expect(app.upstreams.auth.lastRequest?.headers['x-user-id']).toBeUndefined();
  });

  it('GET /api/search is public (bypasses auth) and proxied to the search service', async () => {
    app.upstreams.search.setResponse({ status: 200, body: { results: [] } });
    const res = await fetch(`${app.baseUrl}/api/search?q=rice`);
    expect(res.status).toBe(200);
    expect(app.upstreams.search.lastRequest?.url).toBe('/search?q=rice');
  });
});

describe('Protected routes require a valid JWT (Req 2.1, 2.2)', () => {
  it('rejects a missing token with 401', async () => {
    const res = await fetch(`${app.baseUrl}/api/auth/me`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('MISSING_TOKEN');
  });

  it('rejects a malformed token with 401', async () => {
    const res = await fetch(`${app.baseUrl}/api/auth/me`, {
      headers: { authorization: 'Bearer not-a-jwt' },
    });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INVALID_TOKEN');
  });

  it('rejects an expired token with 401', async () => {
    const token = signToken('user-1', 'RETAILER', { expiresInSeconds: -10 });
    const res = await fetch(`${app.baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it('rejects a token signed by the wrong key with 401', async () => {
    const token = signToken('user-1', 'RETAILER', { wrongKey: true });
    const res = await fetch(`${app.baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it('accepts a valid token and forwards identity headers + bearer to the upstream (Req 2.1)', async () => {
    app.upstreams.auth.setResponse({ status: 200, body: { id: 'user-1' } });
    const token = signToken('user-1', 'RETAILER');
    const res = await fetch(`${app.baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const fwd = app.upstreams.auth.lastRequest!;
    expect(fwd.headers['x-user-id']).toBe('user-1');
    expect(fwd.headers['x-user-role']).toBe('RETAILER');
    expect(fwd.headers['authorization']).toBe(`Bearer ${token}`);
  });
});

describe('Correlation id propagation (Req 20.2)', () => {
  it('generates an X-Correlation-Id and forwards it to the upstream', async () => {
    app.upstreams.auth.setResponse({ status: 200, body: { ok: true } });
    const res = await fetch(`${app.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.co', password: 'secret123' }),
    });
    const cid = res.headers.get('x-correlation-id');
    expect(cid).toBeTruthy();
    expect(app.upstreams.auth.lastRequest?.headers['x-correlation-id']).toBe(cid);
  });

  it('reuses a client-supplied correlation id end-to-end', async () => {
    app.upstreams.auth.setResponse({ status: 200, body: { ok: true } });
    const supplied = 'corr-12345';
    const res = await fetch(`${app.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-correlation-id': supplied },
      body: JSON.stringify({ email: 'a@b.co', password: 'secret123' }),
    });
    expect(res.headers.get('x-correlation-id')).toBe(supplied);
    expect(app.upstreams.auth.lastRequest?.headers['x-correlation-id']).toBe(supplied);
  });
});
