/**
 * Coarse request-shape validation at the edge (Req 19.3; design: "request shape validation").
 *
 * The gateway performs *shape* validation only — it rejects structurally malformed requests before
 * they reach upstream services. Full domain validation (email format, password policy, price
 * ranges, etc.) remains the responsibility of the owning service, which re-validates authoritative
 * inputs. This keeps the gateway thin while filtering obviously bad requests early.
 *
 * Returns an {@link AppError} describing the first shape problem, or `null` when the shape is
 * acceptable.
 */

import { AppError, Errors } from '@b2b/shared-node';
import type { Request } from 'express';
import type { RouteDef } from '../domain/permissions.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireStringFields(
  body: Record<string, unknown>,
  fields: readonly string[],
): AppError | null {
  const missing = fields.filter((f) => typeof body[f] !== 'string' || (body[f] as string).length === 0);
  if (missing.length > 0) {
    return Errors.validation(
      'INVALID_REQUEST_SHAPE',
      'Request is missing required fields or has the wrong shape',
      missing.map((field) => ({ field, issue: 'required non-empty string' })),
    );
  }
  return null;
}

/**
 * Validate the request shape for the matched route. Bodies on write methods must be JSON objects;
 * a few public, user-facing routes get an explicit required-field check.
 */
export function validateRequestShape(route: RouteDef, req: Request): AppError | null {
  const hasBodyMethod = route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH';

  // Write requests must carry a JSON object body (never an array/primitive/empty).
  if (hasBodyMethod) {
    if (!isPlainObject(req.body)) {
      return Errors.validation('INVALID_REQUEST_SHAPE', 'Request body must be a JSON object');
    }
  }

  const body = req.body as Record<string, unknown>;
  switch (`${route.method} ${route.pattern}`) {
    case 'POST /auth/register':
      return requireStringFields(body, ['email', 'password', 'businessName', 'role']);
    case 'POST /auth/login':
      return requireStringFields(body, ['email', 'password']);
    case 'POST /auth/refresh':
      return requireStringFields(body, ['refreshToken']);
    case 'GET /search': {
      const q = req.query.q;
      if (q !== undefined && (typeof q !== 'string' || q.trim().length === 0)) {
        return Errors.validation('INVALID_QUERY', 'Search query must be a non-empty string', [
          { field: 'q', issue: 'must be a non-empty string when provided' },
        ]);
      }
      return null;
    }
    default:
      return null;
  }
}
