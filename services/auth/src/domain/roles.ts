/**
 * Role and account-status registries for the Auth Service.
 *
 * The platform supports exactly three roles (Req 2.5). Account status drives the
 * authentication state machine (Req 1.1, 1.7, 1.10, 16.2, 16.3).
 */

export const ROLES = ['SUPPLIER', 'RETAILER', 'ADMINISTRATOR'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export const ACCOUNT_STATUSES = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'LOCKED',
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** The preferred-language codes the platform renders content in (Req 17.1). */
export const LANGUAGES = ['en', 'bn'] as const;
export type Language = (typeof LANGUAGES)[number];
