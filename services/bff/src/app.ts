/**
 * Express application factory for the API Gateway / BFF.
 *
 * Wires, in order: the shared correlation-id middleware + structured logger (Req 20.2), per-IP
 * rate limiting (stricter on auth routes), raw-body capture with a size limit (Req 19.3), the BFF's
 * own health probe, and the gateway handler that authorizes (JWT + role matrix) and proxies to the
 * upstream services. Dependencies are injected so the same app can run over real upstreams in
 * production or fakes/ephemeral keys in tests.
 */

import { createLogger, getCorrelationId, correlationId, HttpStatus, type Logger } from '@b2b/shared-node';
import express, { type Express } from 'express';
import type { BffConfig } from './config.js';
import { createGateway } from './gateway/gateway.js';
import { TokenVerifier } from './domain/tokens.js';
import { captureBody } from './middleware/bodyCapture.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRateLimiter, generalRateLimiter } from './middleware/rateLimit.js';
import { createProxy } from './proxy/proxy.js';

export interface AppDeps {
  config: BffConfig;
  /** RS256 public key used to verify access tokens. */
  publicKey: string;
  logger?: Logger;
  /** Injectable fetch for proxy tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export function buildApp(deps: AppDeps): Express {
  const { config } = deps;
  const logger = deps.logger ?? createLogger({ service: 'bff', level: config.logLevel as never });
  const app = express();

  app.disable('x-powered-by');
  // The gateway runs behind a single edge proxy (Render/K8s ingress); trust one hop so the
  // per-IP rate limiter keys on the real client address rather than the proxy's.
  app.set('trust proxy', 1);

  app.use(correlationId({ logger }));

  // BFF's own readiness probe (public, no upstream dependency) — Req 20.1.
  app.get('/health', (req, res) => {
    res.status(HttpStatus.OK).json({ status: 'ok', service: 'bff', correlationId: getCorrelationId(req) ?? '' });
  });

  // General per-IP throttle across all gateway traffic.
  app.use('/api', generalRateLimiter(config.rateLimitWindowMs, config.rateLimitMax));

  // Stricter throttle on the credential-handling auth routes (login/register/refresh).
  const authLimiter = authRateLimiter(config.authRateLimitWindowMs, config.authRateLimitMax);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/refresh', authLimiter);

  // Capture raw body + enforce the body-size limit before proxying.
  app.use('/api', captureBody(config.bodyLimit));

  const verifier = new TokenVerifier(deps.publicKey);
  const proxy = createProxy({
    serviceUrls: config.serviceUrls,
    timeoutMs: config.upstreamTimeoutMs,
    logger,
    fetchImpl: deps.fetchImpl,
  });

  app.use('/api', createGateway({ verifier, proxy }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
