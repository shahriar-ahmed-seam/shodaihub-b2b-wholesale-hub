/**
 * Correlation-id middleware for Express services.
 *
 * Reads an inbound `X-Correlation-Id` header or generates a new UUID when absent, exposes it on
 * the request/response, and (optionally) attaches a per-request structured logger bound to that
 * id. Downstream HTTP calls and emitted events must propagate this id so a single request can be
 * traced end-to-end across services (design: Observability, Req 20.2).
 *
 * `express` is an optional peer dependency: this module imports only its types, so the package
 * builds and is importable even in contexts where express is not installed.
 */

import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Logger } from './logger.js';

/** Canonical header name for the correlation id. */
export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

/** Fields the middleware attaches to the Express request. */
export interface CorrelatedRequestFields {
  correlationId: string;
  log?: Logger;
}

export interface CorrelationMiddlewareOptions {
  /** Optional base logger; when provided, a request-scoped child logger is attached as `req.log`. */
  logger?: Logger;
  /** Header name override (defaults to `X-Correlation-Id`). */
  headerName?: string;
}

/** A valid correlation id is a non-empty, reasonably bounded, single-line token. */
function isValidCorrelationId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
}

/**
 * Create the correlation-id middleware.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { correlationId, createLogger } from '@b2b/shared-node';
 *
 * const app = express();
 * const logger = createLogger({ service: 'auth' });
 * app.use(correlationId({ logger }));
 * ```
 */
export function correlationId(options: CorrelationMiddlewareOptions = {}): RequestHandler {
  const headerName = options.headerName ?? CORRELATION_ID_HEADER;
  const baseLogger = options.logger;

  return function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(headerName);
    const id = isValidCorrelationId(incoming) ? incoming.trim() : randomUUID();

    const correlated = req as Request & CorrelatedRequestFields;
    correlated.correlationId = id;
    if (baseLogger) {
      correlated.log = baseLogger.child(id);
    }

    // Echo the id back so clients/proxies can correlate too.
    res.setHeader(headerName, id);
    next();
  };
}

/** Read the correlation id previously attached by {@link correlationId}, if any. */
export function getCorrelationId(req: Request): string | undefined {
  return (req as Request & Partial<CorrelatedRequestFields>).correlationId;
}
