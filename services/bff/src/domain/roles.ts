/**
 * Role registry for the platform (mirrors the Auth Service's authoritative registry).
 *
 * The platform supports exactly three roles (Req 2.5). The BFF receives the role from a verified
 * JWT claim and uses it to drive the coarse role→route permission matrix (Req 2.3).
 */

export const ROLES = ['SUPPLIER', 'RETAILER', 'ADMINISTRATOR'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
