import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { formatBDT, TAKA_SIGN } from './currency';
import {
  translateWithFallback,
  mergeWithFallback,
  type MessageTree,
} from '../i18n/fallback';

/**
 * Feature: b2b-wholesale-hub, Property 41: Currency formatting and translation fallback
 *   — monetary values render in BDT with the ৳ indicator and exactly two decimals (Req 17.3),
 *     and a missing/blank translation in the selected locale falls back to the English value (Req 17.4).
 *
 * formatBDT and the translation-fallback resolver are kept as pure functions so they can be
 * exhaustively property-tested without rendering React. Every property runs >= 100 iterations.
 */

const ITERATIONS = 200;

// Amounts within the platform's money domain (BDT, 2 decimals, up to NUMERIC(12,2) magnitude).
const moneyArb = fc.double({
  min: 0,
  max: 9_999_999_999,
  noNaN: true,
  noDefaultInfinity: true,
});

describe('Feature: b2b-wholesale-hub, Property 41: currency formatting (Req 17.3)', () => {
  it('always renders the ৳ Taka indicator', () => {
    fc.assert(
      fc.property(moneyArb, fc.constantFrom('en', 'bn'), (amount, locale) => {
        const out = formatBDT(amount, locale as 'en' | 'bn');
        expect(out.includes(TAKA_SIGN)).toBe(true);
      }),
      { numRuns: ITERATIONS },
    );
  });

  it('always renders exactly two decimal places', () => {
    fc.assert(
      fc.property(moneyArb, fc.constantFrom('en', 'bn'), (amount, locale) => {
        const out = formatBDT(amount, locale as 'en' | 'bn');
        // Strip the sign + grouping; the fractional part after the final '.' must be 2 digits.
        const fractional = out.split('.').pop() ?? '';
        expect(fractional).toHaveLength(2);
      }),
      { numRuns: ITERATIONS },
    );
  });

  it('rounds half-up to 2 decimals (en, comparable to a reference computation)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999_999_999 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 9 }),
        (whole, paisa, thirdDigit) => {
          // Construct an amount with a known third decimal digit to verify half-up behaviour.
          const amount = whole + paisa / 100 + thirdDigit / 1000;
          const expectedPaisa = Math.floor(amount * 100 + 0.5);
          const expectedInt = Math.floor(expectedPaisa / 100);
          const expectedFrac = String(expectedPaisa % 100).padStart(2, '0');
          const expected = `${TAKA_SIGN}${expectedInt
            .toString()
            .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${expectedFrac}`;
          expect(formatBDT(amount, 'en')).toBe(expected);
        },
      ),
      { numRuns: ITERATIONS },
    );
  });

  it('uses Bangla digits for bn and Western digits for en, with the same numeric magnitude', () => {
    const banglaDigits = '০১২৩৪৫৬৭৮৯';
    fc.assert(
      fc.property(moneyArb, (amount) => {
        const en = formatBDT(amount, 'en');
        const bn = formatBDT(amount, 'bn');
        // en uses only ASCII digits (besides the ৳ sign, commas and dot).
        expect(/[০-৯]/.test(en)).toBe(false);
        // bn contains no ASCII digits.
        expect(/[0-9]/.test(bn)).toBe(false);
        // Mapping bn digits back to ASCII reproduces the en rendering.
        const bnToAscii = bn.replace(/[০-৯]/g, (d) => String(banglaDigits.indexOf(d)));
        expect(bnToAscii).toBe(en);
      }),
      { numRuns: ITERATIONS },
    );
  });

  it('formats whole numbers and known fixtures correctly', () => {
    expect(formatBDT(0, 'en')).toBe('৳0.00');
    expect(formatBDT(1234.5, 'en')).toBe('৳1,234.50');
    expect(formatBDT(1000000, 'en')).toBe('৳1,000,000.00');
    expect(formatBDT(2.005, 'en')).toBe('৳2.01'); // half-up
    expect(formatBDT(1234.5, 'bn')).toBe('৳১,২৩৪.৫০');
  });
});

describe('Feature: b2b-wholesale-hub, Property 41: translation fallback (Req 17.4)', () => {
  // Generate a flat set of keys and English values, plus a partial primary (bn) catalog.
  const keyArb = fc.stringMatching(/^[a-z]{1,8}(\.[a-z]{1,8}){0,2}$/);
  // Non-blank values: at least one visible character so trim() !== '' (matches "present" semantics).
  const valueArb = fc
    .string({ minLength: 1, maxLength: 24 })
    .map((s) => (s.trim() === '' ? `v${s}` : s));

  it('returns the primary value when present and non-blank, else English, else the key', () => {
    fc.assert(
      fc.property(
        keyArb,
        fc.option(valueArb, { nil: undefined }),
        fc.option(fc.oneof(valueArb, fc.constant('   '), fc.constant('')), { nil: undefined }),
        (key, englishValue, primaryValue) => {
          const fallback: MessageTree = englishValue !== undefined ? buildTree(key, englishValue) : {};
          const primary: MessageTree =
            primaryValue !== undefined ? buildTree(key, primaryValue) : {};

          const resolved = translateWithFallback(primary, fallback, key);

          if (primaryValue !== undefined && primaryValue.trim() !== '') {
            expect(resolved).toBe(primaryValue);
          } else if (englishValue !== undefined && englishValue.trim() !== '') {
            expect(resolved).toBe(englishValue);
          } else {
            expect(resolved).toBe(key);
          }
        },
      ),
      { numRuns: ITERATIONS },
    );
  });

  it('never throws and never returns an empty string for a known English key', () => {
    fc.assert(
      fc.property(keyArb, valueArb, (key, englishValue) => {
        const fallback = buildTree(key, englishValue);
        const resolved = translateWithFallback({}, fallback, key);
        expect(resolved.length).toBeGreaterThan(0);
        expect(resolved).toBe(englishValue);
      }),
      { numRuns: ITERATIONS },
    );
  });

  it('mergeWithFallback fills missing/blank primary keys from the English base', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.stringMatching(/^[a-z]{1,8}$/), valueArb, { minKeys: 1, maxKeys: 6 }),
        (enFlat) => {
          const base: MessageTree = { ...enFlat };
          // Primary overrides only the first key, leaving the rest missing.
          const keys = Object.keys(enFlat);
          const firstKey = keys[0]!;
          const override: MessageTree = { [firstKey]: 'অনূদিত' };
          const merged = mergeWithFallback(base, override);

          expect(merged[firstKey]).toBe('অনূদিত');
          for (const k of keys.slice(1)) {
            // Missing in override → English base preserved (Req 17.4).
            expect(merged[k]).toBe(enFlat[k]);
          }
        },
      ),
      { numRuns: ITERATIONS },
    );
  });
});

/** Build a nested catalog tree from a dotted key and a leaf value. */
function buildTree(dottedKey: string, value: string): MessageTree {
  const segments = dottedKey.split('.');
  const root: MessageTree = {};
  let node = root;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      node[segment] = value;
    } else {
      const child: MessageTree = {};
      node[segment] = child;
      node = child;
    }
  });
  return root;
}
