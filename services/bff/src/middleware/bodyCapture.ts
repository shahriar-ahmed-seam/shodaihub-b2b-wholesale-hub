/**
 * Raw request-body capture with an enforced size limit (Req 19.3 input handling; design:
 * "Rate limiting and request-body size limits").
 *
 * The gateway is a thin pass-through proxy, so it captures the *raw bytes* of the request body and
 * forwards them verbatim to the upstream service. Forwarding raw bytes (rather than re-serializing
 * a parsed object) preserves exact payloads — important for, e.g., provider webhook HMACs that are
 * computed over the original body (Req 11.6). A JSON copy is also parsed when the content type is
 * JSON so route-level shape validation can inspect it without re-reading the stream.
 *
 * Bodies exceeding the configured limit are rejected with 413 before any upstream call is made.
 */

import { AppError, Errors } from '@b2b/shared-node';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Payload-too-large error (413) — the shared table has no dedicated helper for this edge case. */
function payloadTooLarge(): AppError {
  return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the allowed size');
}

export interface CapturedBodyFields {
  rawBody?: Buffer;
}

/** Parse a body-limit string such as `256kb`, `1mb`, or a plain byte count into bytes. */
export function parseByteLimit(limit: string): number {
  const trimmed = limit.trim().toLowerCase();
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/.exec(trimmed);
  if (!match) return 256 * 1024;
  const value = Number.parseFloat(match[1]!);
  const unit = match[2] ?? 'b';
  const multiplier = unit === 'gb' ? 1024 ** 3 : unit === 'mb' ? 1024 ** 2 : unit === 'kb' ? 1024 : 1;
  return Math.floor(value * multiplier);
}

function isJsonContentType(req: Request): boolean {
  const ct = req.headers['content-type'];
  return typeof ct === 'string' && ct.toLowerCase().includes('application/json');
}

export function captureBody(limit: string): RequestHandler {
  const maxBytes = parseByteLimit(limit);

  return function bodyCaptureMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const chunks: Buffer[] = [];
    let total = 0;
    let aborted = false;

    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      total += chunk.length;
      if (total > maxBytes) {
        aborted = true;
        next(payloadTooLarge());
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (aborted) return;
      const raw = Buffer.concat(chunks);
      (req as Request & CapturedBodyFields).rawBody = raw;

      if (raw.length > 0 && isJsonContentType(req)) {
        try {
          req.body = JSON.parse(raw.toString('utf8'));
        } catch {
          next(Errors.badRequest('INVALID_JSON', 'Request body is not valid JSON'));
          return;
        }
      }
      next();
    });

    req.on('error', (err) => {
      if (aborted) return;
      aborted = true;
      next(err);
    });
  };
}
