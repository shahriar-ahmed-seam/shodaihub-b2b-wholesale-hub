/**
 * Coarse role→route permission matrix for the API Gateway / BFF (Req 2.3, 2.4).
 *
 * This module is the *pure, side-effect-free core* of the gateway's authorization: given a route
 * table, an HTTP method, a request path, and the caller's role (or `null` when unauthenticated),
 * it decides allow / unauthenticated / forbidden / not-found. Because it is pure it can be
 * property-tested exhaustively over (role, route) pairs (Property 34) without any live upstream
 * service, JWT, or network.
 *
 * ── Scope of authorization performed here (coarse) ──────────────────────────────────────────
 * The BFF performs *coarse role gating* only: "may a SUPPLIER/RETAILER/ADMINISTRATOR call this
 * route at all?". It deliberately does NOT perform fine-grained, per-resource ownership checks
 * (e.g. "is this the supplier who owns *this* product?", "is this the retailer who owns *this*
 * order?"). Those ownership checks are re-evaluated authoritatively inside the owning service —
 * the Inventory Service — against persisted ownership (Req 2.4; design: Security → Authorization,
 * "the Inventory Service additionally enforces resource ownership for supplier-owned entities").
 * Routes that carry downstream ownership semantics are annotated with {@link RouteDef.ownership}
 * purely as documentation of that contract; it does not affect the coarse decision.
 *
 * The role mapping is derived directly from the design's API contract tables (Auth column):
 *   public            → no authentication required (bypasses the JWT gate)
 *   bearer            → any authenticated role
 *   supplier          → SUPPLIER
 *   supplier(owner)   → SUPPLIER or ADMINISTRATOR (admin may modify supplier-owned resources; the
 *                       owning-supplier check is re-applied in Inventory)
 *   retailer          → RETAILER
 *   retailer(owner)   → RETAILER (owning-retailer check re-applied in Inventory)
 *   supplier/logistics→ SUPPLIER or ADMINISTRATOR
 *   authorized        → any authenticated role (the cancel path; ownership re-checked downstream)
 *   admin             → ADMINISTRATOR
 *   provider HMAC     → public at the edge; authenticity verified downstream by the Payment service
 *   internal          → NOT exposed through the public gateway at all
 */

import { ROLES, type Role } from './roles.js';

/** Logical upstream services the gateway fans out to. */
export type UpstreamService = 'auth' | 'inventory' | 'search' | 'payment';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** Authentication requirement for a route. */
export type AuthRequirement = 'public' | 'authenticated';

/** Documentation-only marker of which service re-checks fine-grained ownership downstream. */
export type OwnershipScope = 'none' | 'supplier' | 'retailer';

export interface RouteDef {
  method: HttpMethod;
  /** Path pattern using `:param` segments, e.g. `/products/:id/publish`. No `/api` prefix. */
  pattern: string;
  /** Upstream service this route is proxied to. */
  service: UpstreamService;
  /** Whether a valid JWT is required. */
  auth: AuthRequirement;
  /** Roles permitted when `auth === 'authenticated'`. Ignored for public routes. */
  allowedRoles: readonly Role[];
  /** Fine-grained ownership re-checked downstream (documentation only — not enforced here). */
  ownership: OwnershipScope;
}

const ALL_ROLES: readonly Role[] = ROLES;
const SUPPLIER: readonly Role[] = ['SUPPLIER'];
const RETAILER: readonly Role[] = ['RETAILER'];
const ADMIN: readonly Role[] = ['ADMINISTRATOR'];
const SUPPLIER_OR_ADMIN: readonly Role[] = ['SUPPLIER', 'ADMINISTRATOR'];

/**
 * The authoritative gateway route table. Mirrors the design's API contract tables. `/internal/*`
 * search endpoints are intentionally omitted — they are not reachable through the public gateway.
 */
export const ROUTE_TABLE: readonly RouteDef[] = [
  // ───────────────────────────── Auth Service ─────────────────────────────
  { method: 'POST', pattern: '/auth/register', service: 'auth', auth: 'public', allowedRoles: [], ownership: 'none' },
  { method: 'POST', pattern: '/auth/login', service: 'auth', auth: 'public', allowedRoles: [], ownership: 'none' },
  { method: 'POST', pattern: '/auth/refresh', service: 'auth', auth: 'public', allowedRoles: [], ownership: 'none' },
  { method: 'GET', pattern: '/auth/health', service: 'auth', auth: 'public', allowedRoles: [], ownership: 'none' },
  { method: 'POST', pattern: '/auth/logout', service: 'auth', auth: 'authenticated', allowedRoles: ALL_ROLES, ownership: 'none' },
  { method: 'GET', pattern: '/auth/me', service: 'auth', auth: 'authenticated', allowedRoles: ALL_ROLES, ownership: 'none' },
  { method: 'POST', pattern: '/auth/admin/users/:id/suspend', service: 'auth', auth: 'authenticated', allowedRoles: ADMIN, ownership: 'none' },

  // ─────────────────────────── Inventory Service ───────────────────────────
  { method: 'POST', pattern: '/suppliers/kyc', service: 'inventory', auth: 'authenticated', allowedRoles: SUPPLIER, ownership: 'none' },
  { method: 'POST', pattern: '/admin/suppliers/:id/kyc/approve', service: 'inventory', auth: 'authenticated', allowedRoles: ADMIN, ownership: 'none' },
  { method: 'POST', pattern: '/admin/suppliers/:id/kyc/reject', service: 'inventory', auth: 'authenticated', allowedRoles: ADMIN, ownership: 'none' },
  { method: 'POST', pattern: '/products', service: 'inventory', auth: 'authenticated', allowedRoles: SUPPLIER, ownership: 'none' },
  { method: 'PUT', pattern: '/products/:id', service: 'inventory', auth: 'authenticated', allowedRoles: SUPPLIER_OR_ADMIN, ownership: 'supplier' },
  { method: 'POST', pattern: '/products/:id/publish', service: 'inventory', auth: 'authenticated', allowedRoles: SUPPLIER_OR_ADMIN, ownership: 'supplier' },
  { method: 'POST', pattern: '/products/:id/unpublish', service: 'inventory', auth: 'authenticated', allowedRoles: SUPPLIER_OR_ADMIN, ownership: 'supplier' },
  { method: 'GET', pattern: '/suppliers/me/products', service: 'inventory', auth: 'authenticated', allowedRoles: SUPPLIER, ownership: 'none' },
  { method: 'POST', pattern: '/products/:id/tiers', service: 'inventory', auth: 'authenticated', allowedRoles: SUPPLIER_OR_ADMIN, ownership: 'supplier' },
  { method: 'PUT', pattern: '/products/:id/stock', service: 'inventory', auth: 'authenticated', allowedRoles: SUPPLIER_OR_ADMIN, ownership: 'supplier' },
  { method: 'POST', pattern: '/pricing/quote', service: 'inventory', auth: 'authenticated', allowedRoles: RETAILER, ownership: 'none' },
  { method: 'POST', pattern: '/cart/items', service: 'inventory', auth: 'authenticated', allowedRoles: RETAILER, ownership: 'retailer' },
  { method: 'PUT', pattern: '/cart/items/:id', service: 'inventory', auth: 'authenticated', allowedRoles: RETAILER, ownership: 'retailer' },
  { method: 'DELETE', pattern: '/cart/items/:id', service: 'inventory', auth: 'authenticated', allowedRoles: RETAILER, ownership: 'retailer' },
  { method: 'GET', pattern: '/cart', service: 'inventory', auth: 'authenticated', allowedRoles: RETAILER, ownership: 'retailer' },
  { method: 'POST', pattern: '/cart/reservations/:id/renew', service: 'inventory', auth: 'authenticated', allowedRoles: RETAILER, ownership: 'retailer' },
  { method: 'POST', pattern: '/checkout', service: 'inventory', auth: 'authenticated', allowedRoles: RETAILER, ownership: 'retailer' },
  { method: 'GET', pattern: '/orders/:id', service: 'inventory', auth: 'authenticated', allowedRoles: RETAILER, ownership: 'retailer' },
  { method: 'GET', pattern: '/orders', service: 'inventory', auth: 'authenticated', allowedRoles: RETAILER, ownership: 'retailer' },
  { method: 'POST', pattern: '/suborders/:id/pack', service: 'inventory', auth: 'authenticated', allowedRoles: SUPPLIER_OR_ADMIN, ownership: 'supplier' },
  { method: 'POST', pattern: '/suborders/:id/ship', service: 'inventory', auth: 'authenticated', allowedRoles: SUPPLIER_OR_ADMIN, ownership: 'supplier' },
  { method: 'POST', pattern: '/suborders/:id/deliver', service: 'inventory', auth: 'authenticated', allowedRoles: SUPPLIER_OR_ADMIN, ownership: 'supplier' },
  { method: 'POST', pattern: '/suborders/:id/cancel', service: 'inventory', auth: 'authenticated', allowedRoles: ALL_ROLES, ownership: 'supplier' },
  { method: 'POST', pattern: '/products/:id/reviews', service: 'inventory', auth: 'authenticated', allowedRoles: RETAILER, ownership: 'retailer' },
  { method: 'DELETE', pattern: '/admin/reviews/:id', service: 'inventory', auth: 'authenticated', allowedRoles: ADMIN, ownership: 'none' },
  { method: 'POST', pattern: '/admin/products/:id/remove', service: 'inventory', auth: 'authenticated', allowedRoles: ADMIN, ownership: 'none' },
  { method: 'GET', pattern: '/admin/metrics', service: 'inventory', auth: 'authenticated', allowedRoles: ADMIN, ownership: 'none' },
  { method: 'GET', pattern: '/inventory/health', service: 'inventory', auth: 'public', allowedRoles: [], ownership: 'none' },

  // ───────────────────────────── Search Service ─────────────────────────────
  // Search is public at the edge (task 3.1: login/register/refresh/search/health bypass auth).
  { method: 'GET', pattern: '/search', service: 'search', auth: 'public', allowedRoles: [], ownership: 'none' },
  { method: 'GET', pattern: '/search/health', service: 'search', auth: 'public', allowedRoles: [], ownership: 'none' },

  // ───────────────────────────── Payment Gateway ─────────────────────────────
  { method: 'POST', pattern: '/payments/initiate', service: 'payment', auth: 'authenticated', allowedRoles: RETAILER, ownership: 'retailer' },
  // Provider webhooks are public at the edge; authenticity (HMAC) is verified by the Payment service.
  { method: 'POST', pattern: '/payments/callback/:provider', service: 'payment', auth: 'public', allowedRoles: [], ownership: 'none' },
  { method: 'GET', pattern: '/payments/:txnId', service: 'payment', auth: 'authenticated', allowedRoles: RETAILER, ownership: 'retailer' },
];

/** Outcome of a coarse authorization decision. */
export type AuthorizationDecision =
  | { type: 'allow'; route: RouteDef }
  | { type: 'unauthenticated' } // 401: route requires auth, no/invalid identity supplied
  | { type: 'forbidden'; route: RouteDef } // 403: authenticated, but role not permitted
  | { type: 'not_found' }; // 404: no route matches method + path

/** Split a path into non-empty segments, ignoring the query string and trailing slashes. */
function segments(path: string): string[] {
  const withoutQuery = path.split('?', 1)[0]!;
  return withoutQuery.split('/').filter((s) => s.length > 0);
}

/** Does a concrete request path match a route pattern (with `:param` wildcards)? */
export function matchPattern(pattern: string, path: string): boolean {
  const pat = segments(pattern);
  const req = segments(path);
  if (pat.length !== req.length) return false;
  for (let i = 0; i < pat.length; i += 1) {
    const p = pat[i]!;
    if (p.startsWith(':')) {
      // Param segment matches any single non-empty segment.
      if (req[i]!.length === 0) return false;
      continue;
    }
    if (p !== req[i]) return false;
  }
  return true;
}

/** Find the route definition matching a method + path, or `undefined` when none matches. */
export function matchRoute(
  method: string,
  path: string,
  table: readonly RouteDef[] = ROUTE_TABLE,
): RouteDef | undefined {
  const upper = method.toUpperCase();
  return table.find((r) => r.method === upper && matchPattern(r.pattern, path));
}

/**
 * The pure authorization function (Property 34).
 *
 * @param role The caller's verified role, or `null` when the request carries no valid identity.
 * @param method HTTP method.
 * @param path Request path (no `/api` prefix; query string ignored).
 *
 * Contract:
 *  - no matching route               → `not_found`
 *  - matching public route           → `allow` (regardless of role, even when role is null)
 *  - matching authenticated route, role === null → `unauthenticated`
 *  - matching authenticated route, role ∈ allowedRoles → `allow`
 *  - matching authenticated route, role ∉ allowedRoles → `forbidden`
 */
export function authorize(
  role: Role | null,
  method: string,
  path: string,
  table: readonly RouteDef[] = ROUTE_TABLE,
): AuthorizationDecision {
  const route = matchRoute(method, path, table);
  if (!route) return { type: 'not_found' };

  if (route.auth === 'public') {
    return { type: 'allow', route };
  }

  if (role === null) {
    return { type: 'unauthenticated' };
  }

  if (route.allowedRoles.includes(role)) {
    return { type: 'allow', route };
  }

  return { type: 'forbidden', route };
}
