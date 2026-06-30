/**
 * Express error/404 handling: renders {@link AppError} (and unknown errors) as the shared error
 * envelope, stamped with the request's correlation id (design: Error Handling). Body-parser
 * "payload too large" errors are mapped to a 413 envelope so the body-size limit (Req 19.3) is
 * reported consistently.
 */

import { AppError, getCorrelationId, HttpStatus, makeError } from '@b2b/shared-node';
import type { ErrorRequestHandler, RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (req, res) => {
  const correlationId = getCorrelationId(req) ?? '';
  res
    .status(HttpStatus.NOT_FOUND)
    .json(makeError('NOT_FOUND', `No route for ${req.method} ${req.path}`, correlationId));
};

interface MaybeStatusError {
  status?: number;
  statusCode?: number;
  type?: string;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const correlationId = getCorrelationId(req) ?? '';

  if (err instanceof AppError) {
    res.status(err.status).json(err.toEnvelope(correlationId));
    return;
  }

  // Body-parser limit / malformed JSON surface as errors carrying an HTTP status.
  const candidate = err as MaybeStatusError;
  const status = candidate.status ?? candidate.statusCode;
  if (status === 413) {
    res
      .status(413)
      .json(makeError('PAYLOAD_TOO_LARGE', 'Request body exceeds the allowed size', correlationId));
    return;
  }
  if (status === 400 && candidate.type === 'entity.parse.failed') {
    res
      .status(HttpStatus.BAD_REQUEST)
      .json(makeError('INVALID_JSON', 'Request body is not valid JSON', correlationId));
    return;
  }

  const log = (req as { log?: { error: (m: string, c?: Record<string, unknown>) => void } }).log;
  log?.error('Unhandled error', { error: String(err) });
  res
    .status(HttpStatus.INTERNAL_SERVER_ERROR)
    .json(makeError('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
};
