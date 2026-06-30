/**
 * Payment provider identity + binding logic (Req 11.1).
 *
 * The Payment Gateway supports exactly three providers and binds exactly one of them to each
 * payment transaction. {@link bindProvider} is a pure function so the binding invariant
 * (Property 25) can be property-tested without any I/O.
 */

import { AppError, HttpStatus } from '@b2b/shared-node';

/** The three supported payment providers (Req 11.1). */
export const PROVIDERS = ['bkash', 'nagad', 'sslcommerz'] as const;

export type Provider = (typeof PROVIDERS)[number];

/** Type guard: is `value` one of the supported providers? */
export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value);
}

/**
 * Resolve and validate the provider a transaction will be bound to.
 *
 * Returns exactly one provider when the request names a supported one, otherwise throws a
 * validation error. This guarantees the "binds exactly one provider" invariant (Req 11.1).
 */
export function bindProvider(requested: unknown): Provider {
  if (!isProvider(requested)) {
    throw new AppError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'UNSUPPORTED_PROVIDER',
      `Payment provider must be one of: ${PROVIDERS.join(', ')}`,
      [{ field: 'provider', issue: 'unsupported or missing payment provider' }],
    );
  }
  return requested;
}
