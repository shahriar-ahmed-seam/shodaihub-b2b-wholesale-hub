/**
 * Per-IP rate limiting at the edge (design: "Rate limiting"; Req 2.4 coarse protection).
 *
 * Two limiters are provided:
 *  - {@link generalRateLimiter} applies a generous per-IP cap across all gateway traffic.
 *  - {@link authRateLimiter} applies a much stricter per-IP/per-account cap to the auth routes
 *    (login / register / refresh) to slow credential stuffing and brute-force attempts, reinforcing
 *    the Auth Service's own account-lockout (Req 1.7).
 *
 * Both render the shared error envelope with the request correlation id on a 429.
 */

import { getCorrelationId, HttpStatus, makeError } from '@b2b/shared-node';
import type { Request, Response } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  code: string;
  message: string;
}

function limitReached(code: string, message: string) {
  return (req: Request, res: Response): void => {
    const correlationId = getCorrelationId(req) ?? '';
    res.status(HttpStatus.TOO_MANY_REQUESTS).json(makeError(code, message, correlationId));
  };
}

function buildLimiter(opts: RateLimitOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: limitReached(opts.code, opts.message),
  });
}

export function generalRateLimiter(windowMs: number, max: number): RateLimitRequestHandler {
  return buildLimiter({
    windowMs,
    max,
    code: 'RATE_LIMITED',
    message: 'Too many requests; please slow down and retry shortly',
  });
}

export function authRateLimiter(windowMs: number, max: number): RateLimitRequestHandler {
  return buildLimiter({
    windowMs,
    max,
    code: 'AUTH_RATE_LIMITED',
    message: 'Too many authentication attempts; please retry later',
  });
}
