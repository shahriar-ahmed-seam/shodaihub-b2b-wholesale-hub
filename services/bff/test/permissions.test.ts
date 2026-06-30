/**
 * Task 3.3 — Property 34: Role and ownership authorization.
 * Validates: Requirements 2.3, 2.4
 *
 * Feature: b2b-wholesale-hub, Property 34: Role and ownership authorization.
 * For any authenticated user, role, and target action, the action is permitted if and only if the
 * user's role is authorized for it, and modification of a supplier-owned resource is permitted only
 * for the owning supplier or an administrator; otherwise a 403 is returned.
 *
 * This suite exercises the PURE role→route permission-matrix function (`authorize`) over generated
 * (role, route) pairs — no JWT, no network, no upstream services. It asserts the coarse allow/deny
 * contract the BFF enforces.
 *
 * OWNERSHIP NOTE (Req 2.4): the BFF performs only coarse ROLE gating. Fine-grained, per-resource
 * ownership ("is this the supplier who owns *this* product / the retailer who owns *this* order?")
 * is intentionally NOT decided here — it is re-checked authoritatively inside the Inventory Service
 * against persisted ownership. Routes carrying that downstream contract are annotated with an
 * `ownership` scope, asserted below to be present but non-authoritative at the gateway.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  authorize,
  ROUTE_TABLE,
  matchPattern,
  type RouteDef,
} from '../src/domain/permissions.js';
import { ROLES, type Role } from '../src/domain/roles.js';

/** Build a concrete request path from a pattern, substituting `:param` segments with tokens. */
function concretePath(pattern: string, tokens: string[]): string {
  let i = 0;
  const parts = pattern
    .split('/')
    .filter((s) => s.length > 0)
    .map((seg) => (seg.startsWith(':') ? tokens[i++ % tokens.length]! : seg));
  return '/' + parts.join('/');
}

const routeArb: fc.Arbitrary<RouteDef> = fc.constantFrom(...ROUTE_TABLE);
const roleOrNullArb: fc.Arbitrary<Role | null> = fc.constantFrom<Role | null>(...ROLES, null);
// UUIDs are valid single path segments (non-empty, no `/` or `?`).
const tokensArb = fc.array(fc.uuid(), { minLength: 1, maxLength: 3 });

describe('Property 34: Role and ownership authorization', () => {
  it('public routes are allowed for every role and for unauthenticated callers', () => {
    fc.assert(
      fc.property(
        routeArb.filter((r) => r.auth === 'public'),
        roleOrNullArb,
        tokensArb,
        (route, role, tokens) => {
          const path = concretePath(route.pattern, tokens);
          const decision = authorize(role, route.method, path);
          expect(decision.type).toBe('allow');
          if (decision.type === 'allow') {
            expect(decision.route.pattern).toBe(route.pattern);
            expect(decision.route.method).toBe(route.method);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('protected routes allow a role iff it is in the route\'s allowed set, else 403', () => {
    fc.assert(
      fc.property(
        routeArb.filter((r) => r.auth === 'authenticated'),
        fc.constantFrom<Role>(...ROLES),
        tokensArb,
        (route, role, tokens) => {
          const path = concretePath(route.pattern, tokens);
          const decision = authorize(role, route.method, path);
          const expectedAllowed = route.allowedRoles.includes(role);

          if (expectedAllowed) {
            expect(decision.type).toBe('allow');
            if (decision.type === 'allow') {
              expect(decision.route.pattern).toBe(route.pattern);
            }
          } else {
            expect(decision.type).toBe('forbidden');
            if (decision.type === 'forbidden') {
              expect(decision.route.pattern).toBe(route.pattern);
            }
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('protected routes reject unauthenticated callers (null role) with 401-intent', () => {
    fc.assert(
      fc.property(
        routeArb.filter((r) => r.auth === 'authenticated'),
        tokensArb,
        (route, tokens) => {
          const path = concretePath(route.pattern, tokens);
          const decision = authorize(null, route.method, path);
          expect(decision.type).toBe('unauthenticated');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('unknown paths resolve to not_found regardless of role', () => {
    fc.assert(
      fc.property(
        roleOrNullArb,
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 4 }),
        (role, method, segs) => {
          const path = '/__nonexistent__/' + segs.join('/');
          fc.pre(!ROUTE_TABLE.some((r) => matchPattern(r.pattern, path)));
          expect(authorize(role, method, path).type).toBe('not_found');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('a known pattern under a method that is not registered is not_found', () => {
    fc.assert(
      fc.property(routeArb, fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'), tokensArb, (route, method, tokens) => {
        const path = concretePath(route.pattern, tokens);
        // Only assert for methods that match NO route at this exact path.
        const anyMatch = ROUTE_TABLE.some((r) => r.method === method && matchPattern(r.pattern, path));
        fc.pre(!anyMatch);
        expect(authorize(null, method, path).type).toBe('not_found');
      }),
      { numRuns: 300 },
    );
  });

  // ── Ownership contract (Req 2.4) — coarse at the gateway, re-checked in Inventory ──
  describe('supplier-owned resource modification: owning supplier or administrator (coarse)', () => {
    const supplierOwnedWrites = ROUTE_TABLE.filter(
      (r) => r.ownership === 'supplier' && r.allowedRoles.includes('SUPPLIER'),
    );

    it('every supplier-owned modification route permits SUPPLIER and ADMINISTRATOR', () => {
      for (const route of supplierOwnedWrites) {
        const path = concretePath(route.pattern, ['11111111-1111-1111-1111-111111111111']);
        // The /suborders/:id/cancel route is "authorized" (any role); the rest are supplier+admin.
        if (route.pattern === '/suborders/:id/cancel') {
          expect(authorize('ADMINISTRATOR', route.method, path).type).toBe('allow');
          expect(authorize('SUPPLIER', route.method, path).type).toBe('allow');
        } else {
          expect(authorize('SUPPLIER', route.method, path).type).toBe('allow');
          expect(authorize('ADMINISTRATOR', route.method, path).type).toBe('allow');
          // A retailer is coarsely forbidden from modifying supplier-owned resources.
          expect(authorize('RETAILER', route.method, path).type).toBe('forbidden');
        }
      }
      expect(supplierOwnedWrites.length).toBeGreaterThan(0);
    });

    it('documents that fine-grained ownership is re-checked downstream (annotation present)', () => {
      // The gateway decision is COARSE: it never inspects the resource id, so two different ids
      // under the same supplier-owned route yield the identical role-based decision. The actual
      // "is this the OWNING supplier?" check is performed by the Inventory Service.
      for (const route of supplierOwnedWrites) {
        const a = concretePath(route.pattern, ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
        const b = concretePath(route.pattern, ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']);
        expect(authorize('SUPPLIER', route.method, a).type).toBe(
          authorize('SUPPLIER', route.method, b).type,
        );
        expect(['supplier', 'retailer', 'none']).toContain(route.ownership);
      }
    });
  });
});
