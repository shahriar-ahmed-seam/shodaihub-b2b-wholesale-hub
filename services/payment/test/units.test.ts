/**
 * Focused unit tests for the pure helpers: BDT money normalization, constant-time signature
 * comparison edge cases, and RESP command encoding.
 */

import { describe, expect, it } from 'vitest';
import { amountsEqual, fromPaisa, normalizeBdt, toPaisa } from '../src/domain/money.js';
import { constantTimeEqualHex } from '../src/domain/signature.js';
import { encodeResp, parseRedisUrl } from '../src/events/publisher.js';

describe('money', () => {
  it('normalizes numbers and strings to canonical 2-decimal BDT', () => {
    expect(normalizeBdt(10)).toBe('10.00');
    expect(normalizeBdt('10')).toBe('10.00');
    expect(normalizeBdt('10.5')).toBe('10.50');
    expect(normalizeBdt('1234.56')).toBe('1234.56');
  });

  it('rejects non-positive and malformed amounts', () => {
    expect(() => normalizeBdt(0)).toThrow();
    expect(() => normalizeBdt(-5)).toThrow();
    expect(() => normalizeBdt('abc')).toThrow();
    expect(() => normalizeBdt('1.234')).toThrow();
    expect(() => normalizeBdt(Number.NaN)).toThrow();
  });

  it('round-trips through paisa', () => {
    expect(toPaisa('1234.56')).toBe(123456);
    expect(fromPaisa(123456)).toBe('1234.56');
    expect(fromPaisa(5)).toBe('0.05');
    expect(amountsEqual('10.5', '10.50')).toBe(true);
  });
});

describe('constantTimeEqualHex', () => {
  it('returns true only for identical equal-length hex', () => {
    expect(constantTimeEqualHex('abcd', 'abcd')).toBe(true);
    expect(constantTimeEqualHex('abcd', 'abce')).toBe(false);
    // length mismatch → false, no throw
    expect(constantTimeEqualHex('abcd', 'abcdef')).toBe(false);
    // empty → false
    expect(constantTimeEqualHex('', '')).toBe(false);
  });
});

describe('encodeResp', () => {
  it('encodes a RESP array of bulk strings', () => {
    expect(encodeResp(['XADD', 's', '*']).toString('utf8')).toBe(
      '*3\r\n$4\r\nXADD\r\n$1\r\ns\r\n$1\r\n*\r\n',
    );
  });

  it('uses byte length for multi-byte values', () => {
    const encoded = encodeResp(['৳']).toString('utf8');
    // '৳' is 3 bytes in UTF-8.
    expect(encoded).toBe('*1\r\n$3\r\n৳\r\n');
  });
});

describe('parseRedisUrl', () => {
  it('parses host and port with a default of 6379', () => {
    expect(parseRedisUrl('redis://redis:6380')).toEqual({ host: 'redis', port: 6380 });
    expect(parseRedisUrl('redis://localhost')).toEqual({ host: 'localhost', port: 6379 });
  });
});
