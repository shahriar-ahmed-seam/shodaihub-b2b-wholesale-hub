/**
 * BDT money handling for the Payment Gateway.
 *
 * Amounts are represented as canonical fixed-2-decimal strings (e.g. `"1234.50"`) to avoid binary
 * floating-point drift across the wire and in the database `NUMERIC(12,2)` column. All payment
 * amounts are in BDT (Req 11.2).
 */

import { AppError, HttpStatus } from '@b2b/shared-node';

/** ISO currency code for Bangladeshi Taka — the only currency the gateway transacts in (Req 11.2). */
export const CURRENCY = 'BDT' as const;

export type Currency = typeof CURRENCY;

const AMOUNT_RE = /^\d{1,10}(\.\d{1,2})?$/;

/**
 * Normalize an amount to a canonical 2-decimal BDT string.
 *
 * Accepts a number or numeric string; rejects negative, zero, non-finite, or malformed values
 * with a validation error. The result always has exactly two decimal places.
 */
export function normalizeBdt(amount: unknown): string {
  let raw: string;
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) {
      throw invalidAmount();
    }
    raw = amount.toFixed(2);
  } else if (typeof amount === 'string') {
    raw = amount.trim();
  } else {
    throw invalidAmount();
  }

  if (!AMOUNT_RE.test(raw)) {
    throw invalidAmount();
  }

  // Reparse via integer paisa to guarantee canonical 2-decimal form and reject 0.00.
  const paisa = toPaisa(raw);
  if (paisa <= 0) {
    throw invalidAmount();
  }
  return fromPaisa(paisa);
}

/** Convert a canonical/parseable amount string to integer paisa (1 BDT = 100 paisa). */
export function toPaisa(amount: string): number {
  const [whole, frac = ''] = amount.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  return Number.parseInt(whole!, 10) * 100 + Number.parseInt(fracPadded, 10);
}

/** Convert integer paisa back to a canonical 2-decimal BDT string. */
export function fromPaisa(paisa: number): string {
  const whole = Math.floor(paisa / 100);
  const frac = paisa % 100;
  return `${whole}.${frac.toString().padStart(2, '0')}`;
}

/** Two amounts are equal when their canonical paisa values match. */
export function amountsEqual(a: string, b: string): boolean {
  return toPaisa(a) === toPaisa(b);
}

function invalidAmount(): AppError {
  return new AppError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'INVALID_AMOUNT',
    'Amount must be a positive BDT value with at most two decimal places',
    [{ field: 'amount', issue: 'invalid or non-positive amount' }],
  );
}
