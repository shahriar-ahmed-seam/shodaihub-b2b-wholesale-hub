import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AppError,
  CORRELATION_ID_HEADER,
  Errors,
  HttpStatus,
  Logger,
  correlationId,
  getCorrelationId,
  makeError,
} from '../dist/index.js';

test('makeError builds the standard envelope and omits empty details', () => {
  const env = makeError('TIER_OVERLAP', 'overlaps', 'cid-1');
  assert.deepEqual(env, {
    error: { code: 'TIER_OVERLAP', message: 'overlaps', correlationId: 'cid-1' },
  });
  assert.equal('details' in env.error, false);
});

test('makeError includes details when provided', () => {
  const env = makeError('VALIDATION', 'bad', 'cid-2', [{ field: 'minQty', issue: 'overlaps' }]);
  assert.deepEqual(env.error.details, [{ field: 'minQty', issue: 'overlaps' }]);
});

test('AppError.toEnvelope stamps the correlation id and carries status/code', () => {
  const err = Errors.conflict('INSUFFICIENT_STOCK', 'not enough');
  assert.ok(err instanceof AppError);
  assert.equal(err.status, HttpStatus.CONFLICT);
  assert.equal(err.code, 'INSUFFICIENT_STOCK');
  const env = err.toEnvelope('cid-3');
  assert.equal(env.error.correlationId, 'cid-3');
  assert.equal(env.error.code, 'INSUFFICIENT_STOCK');
});

test('Errors helpers map situations to the design status codes', () => {
  assert.equal(Errors.validation('E', 'm').status, HttpStatus.UNPROCESSABLE_ENTITY);
  assert.equal(Errors.unauthorized('E', 'm').status, HttpStatus.UNAUTHORIZED);
  assert.equal(Errors.locked('E', 'm').status, HttpStatus.LOCKED);
  assert.equal(Errors.forbidden('E', 'm').status, HttpStatus.FORBIDDEN);
  assert.equal(Errors.notFound('E', 'm').status, HttpStatus.NOT_FOUND);
  assert.equal(Errors.badGateway('E', 'm').status, HttpStatus.BAD_GATEWAY);
});

test('Logger emits one JSON line with the required structured fields', () => {
  const lines = [];
  const log = new Logger({ service: 'auth', sink: (l) => lines.push(l) });
  log.child('cid-9').info('login ok', { userId: 'u1' });
  assert.equal(lines.length, 1);
  const rec = JSON.parse(lines[0]);
  assert.equal(rec.service, 'auth');
  assert.equal(rec.level, 'info');
  assert.equal(rec.correlationId, 'cid-9');
  assert.equal(rec.message, 'login ok');
  assert.deepEqual(rec.context, { userId: 'u1' });
  assert.equal(typeof rec.timestamp, 'string');
});

test('Logger respects the minimum level threshold', () => {
  const lines = [];
  const log = new Logger({ service: 'bff', level: 'warn', sink: (l) => lines.push(l) });
  log.info('ignored');
  log.warn('kept');
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).message, 'kept');
});

// Minimal Express-like req/res doubles to exercise the middleware without an HTTP server.
function fakeReqRes(headerValue) {
  const headers = {};
  const req = { header: (_name) => headerValue };
  const res = {
    setHeader: (name, value) => {
      headers[name] = value;
    },
  };
  return { req, res, headers };
}

test('correlationId reuses a valid inbound header and echoes it', () => {
  const { req, res, headers } = fakeReqRes('inbound-123');
  let called = false;
  correlationId()(req, res, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(getCorrelationId(req), 'inbound-123');
  assert.equal(headers[CORRELATION_ID_HEADER], 'inbound-123');
});

test('correlationId generates a UUID when the header is missing', () => {
  const { req, res, headers } = fakeReqRes(undefined);
  correlationId()(req, res, () => {});
  const id = getCorrelationId(req);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(headers[CORRELATION_ID_HEADER], id);
});

test('correlationId attaches a request-scoped child logger when a base logger is given', () => {
  const lines = [];
  const base = new Logger({ service: 'payment', sink: (l) => lines.push(l) });
  const { req, res } = fakeReqRes('cid-req');
  correlationId({ logger: base })(req, res, () => {});
  req.log.info('handling');
  assert.equal(JSON.parse(lines[0]).correlationId, 'cid-req');
});
