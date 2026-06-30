/**
 * Express error-handling middleware: renders {@link AppError} (and unknown errors) as the shared
 * error envelope, stamped with the request's correlation id (design: Error Handling).
 */

import { AppError, getCorrelationId, HttpStatus, makeError } from '@b2b/shared-node';
import type { ErrorRequestHandler, RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (req, res) => {
  const correlationId = getCorrelationId(req) ?? '';
  res
    .status(HttpStatus.NOT_FOUND)
    .json(makeError('NOT_FOUND', `No route for ${req.method} ${req.path}`, correlationId));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const correlationId = getCorrelationId(req) ?? '';

  if (err instanceof AppError) {
    res.status(err.status).json(err.toEnvelope(correlationId));
    return;
  }

  const log = (req as { log?: { error: (m: string, c?: Record<string, unknown>) => void } }).log;
  log?.error('Unhandled error', { error: String(err) });
  res
    .status(HttpStatus.INTERNAL_SERVER_ERROR)
    .json(makeError('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
};
