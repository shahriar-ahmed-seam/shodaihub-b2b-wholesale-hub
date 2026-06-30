/**
 * The gateway request handler (design: Components → API Gateway/BFF; Request Lifecycle).
 *
 * For every request under `/api` it:
 *   1. matches the route table (unknown route → 404);
 *   2. for protected routes, verifies the RS256 JWT *once* (missing/invalid/expired → 401,
 *      Req 2.1, 2.2) and resolves the caller's identity + role;
 *   3. applies the coarse role→route permission matrix (disallowed role → 403, Req 2.3);
 *   4. performs coarse request-shape validation (Req 19.3);
 *   5. forwards the request to the resolved upstream service, propagating identity headers and the
 *      correlation id (Req 20.2).
 *
 * Fine-grained per-resource ownership is intentionally NOT enforced here; it is re-checked in the
 * Inventory Service against persisted ownership (Req 2.4).
 */

import { Errors } from '@b2b/shared-node';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { authorize, matchRoute, type RouteDef } from '../domain/permissions.js';
import type { Role } from '../domain/roles.js';
import { extractBearer, type TokenVerifier } from '../domain/tokens.js';
import { validateRequestShape } from '../middleware/validation.js';
import type { ForwardIdentity, ProxyHandler } from '../proxy/proxy.js';

export interface GatewayDeps {
  verifier: TokenVerifier;
  proxy: ProxyHandler;
}

function authenticate(
  route: RouteDef,
  req: Request,
  verifier: TokenVerifier,
): { ok: true; identity: ForwardIdentity | null; role: Role | null } | { ok: false; error: Error } {
  if (route.auth === 'public') {
    return { ok: true, identity: null, role: null };
  }

  const bearer = extractBearer(req.header('authorization'));
  if (!bearer) {
    return { ok: false, error: Errors.unauthorized('MISSING_TOKEN', 'Authentication required') };
  }

  const result = verifier.verifyAccessToken(bearer);
  if (!result.valid) {
    return {
      ok: false,
      error: Errors.unauthorized('INVALID_TOKEN', 'Authentication token is invalid or expired'),
    };
  }

  const identity: ForwardIdentity = {
    userId: result.claims.sub,
    role: result.claims.role,
    bearer,
  };
  return { ok: true, identity, role: result.claims.role };
}

export function createGateway(deps: GatewayDeps): RequestHandler {
  return function gateway(req: Request, res: Response, next: NextFunction): void {
    const method = req.method;
    const path = req.path;

    const route = matchRoute(method, path);
    if (!route) {
      // Unknown route → fall through to the 404 handler.
      next();
      return;
    }

    const auth = authenticate(route, req, deps.verifier);
    if (!auth.ok) {
      next(auth.error);
      return;
    }

    const decision = authorize(auth.role, method, path);
    if (decision.type === 'forbidden') {
      next(Errors.forbidden('FORBIDDEN', 'Your role may not perform this action'));
      return;
    }
    if (decision.type === 'unauthenticated') {
      next(Errors.unauthorized('MISSING_TOKEN', 'Authentication required'));
      return;
    }
    if (decision.type === 'not_found') {
      next();
      return;
    }

    const shapeError = validateRequestShape(route, req);
    if (shapeError) {
      next(shapeError);
      return;
    }

    deps
      .proxy(req, res, { service: route.service, path }, auth.identity)
      .catch((err: unknown) => next(err instanceof Error ? err : new Error(String(err))));
  };
}
