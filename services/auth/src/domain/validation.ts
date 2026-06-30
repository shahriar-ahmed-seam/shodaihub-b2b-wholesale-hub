/**
 * Pure registration-input validation (Req 1.1, 1.2, 1.3, 1.8, 2.5).
 *
 * Kept free of I/O so it can be exhaustively property-tested without a database.
 * Duplicate-email detection (Req 1.2) is a repository concern and lives in the service layer.
 */

import { isRole, type Role, LANGUAGES, type Language } from './roles.js';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const BUSINESS_NAME_MIN_LENGTH = 1;
export const BUSINESS_NAME_MAX_LENGTH = 200;

/**
 * Pragmatic email-format check. Requires a single `@`, a non-empty local part with no spaces,
 * and a domain with at least one dot and a 2+ char TLD. Intentionally conservative — it rejects
 * clearly malformed addresses (Req 1.8) without attempting full RFC 5322 coverage.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[^\s@.]{2,}$/;

export function isValidEmailFormat(email: unknown): email is string {
  return (
    typeof email === 'string' &&
    email.length <= 254 &&
    EMAIL_PATTERN.test(email)
  );
}

export interface RegistrationInput {
  email?: unknown;
  password?: unknown;
  businessName?: unknown;
  role?: unknown;
  preferredLanguage?: unknown;
}

export interface NormalizedRegistration {
  email: string;
  password: string;
  businessName: string;
  role: Role;
  preferredLanguage: Language;
}

export interface FieldError {
  field: string;
  issue: string;
}

export type ValidationResult =
  | { ok: true; value: NormalizedRegistration }
  | { ok: false; errors: FieldError[] };

/** Validate and normalize a registration request. Returns every offending field (Req 1.2 style). */
export function validateRegistration(input: RegistrationInput): ValidationResult {
  const errors: FieldError[] = [];

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : input.email;
  if (!isValidEmailFormat(email)) {
    errors.push({ field: 'email', issue: 'must be a valid email address' });
  }

  const password = input.password;
  if (typeof password !== 'string') {
    errors.push({ field: 'password', issue: 'is required' });
  } else if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    errors.push({
      field: 'password',
      issue: `must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
    });
  }

  const businessNameRaw = typeof input.businessName === 'string' ? input.businessName.trim() : input.businessName;
  if (
    typeof businessNameRaw !== 'string' ||
    businessNameRaw.length < BUSINESS_NAME_MIN_LENGTH ||
    businessNameRaw.length > BUSINESS_NAME_MAX_LENGTH
  ) {
    errors.push({
      field: 'businessName',
      issue: `must be between ${BUSINESS_NAME_MIN_LENGTH} and ${BUSINESS_NAME_MAX_LENGTH} characters`,
    });
  }

  if (!isRole(input.role)) {
    errors.push({ field: 'role', issue: 'must be one of SUPPLIER, RETAILER, ADMINISTRATOR' });
  }

  let preferredLanguage: Language = 'en';
  if (input.preferredLanguage !== undefined) {
    if (
      typeof input.preferredLanguage === 'string' &&
      (LANGUAGES as readonly string[]).includes(input.preferredLanguage)
    ) {
      preferredLanguage = input.preferredLanguage as Language;
    } else {
      errors.push({ field: 'preferredLanguage', issue: 'must be one of en, bn' });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      email: email as string,
      password: password as string,
      businessName: businessNameRaw as string,
      role: input.role as Role,
      preferredLanguage,
    },
  };
}
