/**
 * Shared BDT money formatting (Req 17.3) — covered by Property 41.
 *
 * Renders a numeric amount as Bangladeshi Taka with the ৳ indicator and exactly two decimal
 * places. The implementation is deterministic and self-contained (no ICU dependency) so it
 * behaves identically across Node versions and can be exhaustively property-tested:
 *   - half-up rounding to 2 decimals,
 *   - 3-digit thousands grouping on the integer part,
 *   - Western digits for `en`, Bangla digits (০–৯) for `bn`.
 */

export const TAKA_SIGN = '৳';

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export type CurrencyLocale = 'en' | 'bn';

/** Round half-up to 2 decimals, returning integer + 2-digit fractional string parts. */
function roundHalfUp(amount: number): { negative: boolean; intPart: string; fracPart: string } {
  const safe = Number.isFinite(amount) ? amount : 0;
  const negative = safe < 0;
  // Work in integer "paisa" to avoid binary float drift, applying half-up at the 2nd decimal.
  const paisa = Math.floor(Math.abs(safe) * 100 + 0.5);
  const intValue = Math.floor(paisa / 100);
  const fracValue = paisa % 100;
  return {
    negative: negative && paisa !== 0,
    intPart: String(intValue),
    fracPart: String(fracValue).padStart(2, '0'),
  };
}

/** Insert standard 3-digit thousands separators into a non-negative integer string. */
function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function toLocaleDigits(value: string, locale: CurrencyLocale): string {
  if (locale !== 'bn') return value;
  return value.replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)]!);
}

/**
 * Format `amount` as BDT for the given locale, e.g. `৳1,234.50` (en) / `৳১,২৩৪.৫০` (bn).
 * Always includes the ৳ sign and exactly two fractional digits.
 */
export function formatBDT(amount: number, locale: CurrencyLocale = 'en'): string {
  const { negative, intPart, fracPart } = roundHalfUp(amount);
  const grouped = groupThousands(intPart);
  const body = `${TAKA_SIGN}${toLocaleDigits(`${grouped}.${fracPart}`, locale)}`;
  return negative ? `-${body}` : body;
}
