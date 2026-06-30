/**
 * Bearer-token authentication guard (Req 2.1, 2.2).
 *
 * Verifies the RS256 access token's signature + expiry; tampered/expired/malformed/missing tokens
 * yield 401. On success the decoded claims are attached to the request for downstream handlers.
 */

import { Errors } from '@b2b/shared-node';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '../domain/roles.js';
import type { TokenService } from '../domain/tokens.js';

export interface AuthenticatedRequestFields {
  auth?: { userId: string; role: Role };
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1]!.trim() : null;
}

export function requireAuth(tokens: TokenService): RequestHandler {
  return function authGuard(req: Request, res: Response, next: NextFunction): void {
    const token = extractBearer(req.header('authorization'));
    if (!token) {
      next(Errors.unauthorized('MISSING_TOKEN', 'Authentication required'));
      return;
    }
    const result = tokens.verifyAccessToken(token);
    if (!result.valid) {
      next(Errors.unauthorized('INVALID_TOKEN', 'Authentication token is invalid or expired'));
      return;
    }
    (req as Request & AuthenticatedRequestFields).auth = {
      userId: result.claims.sub,
      role: result.claims.role,
    };
    next();
  };
}

/** Coarse role gate (full role→route matrix lives in the BFF; admin endpoints re-check here). */
export function requireRole(...roles: Role[]): RequestHandler {
  return function roleGuard(req: Request, _res: Response, next: NextFunction): void {
    const auth = (req as Request & AuthenticatedRequestFields).auth;
    if (!auth) {
      next(Errors.unauthorized('MISSING_TOKEN', 'Authentication required'));
      return;
    }
    if (!roles.includes(auth.role)) {
      next(Errors.forbidden('FORBIDDEN', 'Your role may not perform this action'));
      return;
    }
    next();
  };
}
