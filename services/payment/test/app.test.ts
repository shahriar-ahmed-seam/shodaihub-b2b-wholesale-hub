/**
 * Route-level integration smoke tests over real HTTP (Express app + in-memory service).
 *
 * Exercises the public API surface: health, initiate, callback (authentic + inauthentic), and
 * status — verifying status codes and the shared error envelope wiring.
 */

import { type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { computeSignature, type CallbackPayload } from '../src/domain/signature.js';
import { createLogger } from '@b2b/shared-node';
import { makeHarness, TEST_SECRETS } from './helpers.js';

let server: Server;
let baseUrl: string;
let harness: ReturnType<typeof makeHarness>;

beforeEach(async () => {
  harness = makeHarness();
  const app = buildApp({
    paymentService: harness.service,
    checkDatabase: async () => true,
    logger: createLogger({ service: 'payment-test', level: 'error', sink: () => {} }),
  });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

describe('Payment routes', () => {
  it('GET /payments/health reports readiness', async () => {
    const res = await fetch(`${baseUrl}/payments/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.service).toBe('payment');
    expect(body.status).toBe('ok');
  });

  it('POST /payments/initiate creates a bound transaction and returns a checkout URL', async () => {
    harness.inventory.totalsByOrder.set('order-7', '1234.50');
    const res = await fetch(`${baseUrl}/payments/initiate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: 'order-7', provider: 'bkash' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      txnId: string;
      provider: string;
      amount: string;
      currency: string;
      checkoutUrl: string;
    };
    expect(body.provider).toBe('bkash');
    expect(body.amount).toBe('1234.50');
    expect(body.currency).toBe('BDT');
    expect(body.checkoutUrl).toContain(body.txnId);
  });

  it('rejects an unsupported provider with a 422 error envelope', async () => {
    const res = await fetch(`${baseUrl}/payments/initiate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: 'order-7', provider: 'paypal' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string; correlationId: string } };
    expect(body.error.code).toBe('UNSUPPORTED_PROVIDER');
    expect(typeof body.error.correlationId).toBe('string');
  });

  it('applies an authentic success callback and exposes SUCCESS via GET /payments/{txnId}', async () => {
    harness.inventory.totalsByOrder.set('order-9', '50.00');
    const initRes = await fetch(`${baseUrl}/payments/initiate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: 'order-9', provider: 'nagad' }),
    });
    const init = (await initRes.json()) as { txnId: string; amount: string };

    const payload: CallbackPayload = {
      txnId: init.txnId,
      orderId: 'order-9',
      status: 'success',
      amount: init.amount,
    };
    const signature = computeSignature(payload, TEST_SECRETS.nagad.secret);
    const cbRes = await fetch(`${baseUrl}/payments/callback/nagad`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, signature }),
    });
    expect(cbRes.status).toBe(200);
    const cb = (await cbRes.json()) as { outcome: string; status: string };
    expect(cb.outcome).toBe('applied');
    expect(cb.status).toBe('SUCCESS');

    const statusRes = await fetch(`${baseUrl}/payments/${init.txnId}`);
    expect(statusRes.status).toBe(200);
    const status = (await statusRes.json()) as { status: string; applied: boolean };
    expect(status.status).toBe('SUCCESS');
    expect(status.applied).toBe(true);
  });

  it('rejects an inauthentic callback with 400 and records it', async () => {
    harness.inventory.totalsByOrder.set('order-bad', '10.00');
    const initRes = await fetch(`${baseUrl}/payments/initiate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: 'order-bad', provider: 'sslcommerz' }),
    });
    const init = (await initRes.json()) as { txnId: string; amount: string };

    const res = await fetch(`${baseUrl}/payments/callback/sslcommerz`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        txnId: init.txnId,
        orderId: 'order-bad',
        status: 'success',
        amount: init.amount,
        signature: 'deadbeef',
      }),
    });
    expect(res.status).toBe(400);
    expect(harness.inventory.confirmCalls).toHaveLength(0);
    expect(await harness.repos.rejectedCallbacks.list()).toHaveLength(1);
  });
});
