/**
 * Integration tests for the Auth Service HTTP surface: wiring of routes, correlation-id middleware,
 * the shared error envelope, the JWT guard, and the readiness probe. Runs the real Express app over
 * in-memory repositories.
 */

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { makeHarness } from './helpers.js';

let server: Server;
let baseUrl: string;
let dbUp = true;
const h = makeHarness();

beforeAll(async () => {
  const app = buildApp({
    authService: h.service,
    tokens: h.tokens,
    checkDatabase: async () => dbUp,
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

describe('Auth HTTP surface', () => {
  it('GET /auth/health reports readiness and DB check', async () => {
    const res = await fetch(`${baseUrl}/auth/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('up');
  });

  it('GET /auth/health returns 503 when the DB is down', async () => {
    dbUp = false;
    const res = await fetch(`${baseUrl}/auth/health`);
    expect(res.status).toBe(503);
    dbUp = true;
  });

  it('register → login → me happy path, with correlation id echoed', async () => {
    const reg = await post('/auth/register', {
      email: 'flow@ex.com',
      password: 'password1234',
      businessName: 'Flow Co',
      role: 'RETAILER',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.user.status).toBe('PENDING_VERIFICATION');
    expect(reg.headers.get('x-correlation-id')).toBeTruthy();

    // Activate the account so it can authenticate.
    await h.repos.users.updateStatus(reg.body.user.id, 'ACTIVE');

    const login = await post('/auth/login', { email: 'flow@ex.com', password: 'password1234' });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();

    const me = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${login.body.accessToken}` },
    });
    expect(me.status).toBe(200);
    const meBody = await me.json();
    expect(meBody.user.email).toBe('flow@ex.com');
  });

  it('validation failure returns the shared error envelope (422)', async () => {
    const res = await post('/auth/register', {
      email: 'not-an-email',
      password: 'short',
      businessName: '',
      role: 'WIZARD',
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBeTruthy();
    expect(res.body.error.correlationId).toBeTruthy();
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('GET /auth/me without a token is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/auth/me`);
    expect(res.status).toBe(401);
  });

  it('admin suspend requires an administrator role (403 for non-admin)', async () => {
    const reg = await post('/auth/register', {
      email: 'retailer@ex.com',
      password: 'password1234',
      businessName: 'R Co',
      role: 'RETAILER',
    });
    await h.repos.users.updateStatus(reg.body.user.id, 'ACTIVE');
    const login = await post('/auth/login', { email: 'retailer@ex.com', password: 'password1234' });

    const res = await post(
      `/auth/admin/users/${reg.body.user.id}/suspend`,
      {},
      { authorization: `Bearer ${login.body.accessToken}` },
    );
    expect(res.status).toBe(403);
  });
});
