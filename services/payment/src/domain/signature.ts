/**
 * Callback authenticity primitives (Req 11.6, 11.8).
 *
 * Every provider callback carries an HMAC signature computed over a canonical serialization of the
 * payload with a provider secret. The gateway recomputes the HMAC and compares it to the supplied
 * value using a constant-time comparison (`crypto.timingSafeEqual`) so verification time does not
 * leak how many leading bytes matched.
 *
 * These are pure functions (no I/O) so the authenticity invariant (Property 26) can be
 * property-tested directly.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Business fields of a callback, excluding the signature itself. */
export interface CallbackPayload {
  txnId: string;
  /** Provider-reported outcome. */
  status: 'success' | 'failed';
  /** Amount in canonical BDT string form. */
  amount: string;
  orderId: string;
  [key: string]: unknown;
}

/**
 * Canonical serialization of a payload for signing: the signed business fields joined in a fixed
 * order with a separator. Using a fixed field order (rather than raw JSON) makes the signature
 * independent of key ordering / whitespace in the received body.
 */
export function canonicalize(payload: CallbackPayload): string {
  return [payload.txnId, payload.status, payload.amount, payload.orderId].join('|');
}

/** Compute the lowercase-hex HMAC-SHA256 signature of a payload with the given secret. */
export function computeSignature(payload: CallbackPayload, secret: string): string {
  return createHmac('sha256', secret).update(canonicalize(payload)).digest('hex');
}

/**
 * Constant-time comparison of two hex signatures.
 *
 * Decodes both to bytes and uses {@link timingSafeEqual}. A length mismatch (or non-hex input)
 * returns false without throwing. Comparison time does not depend on the position of the first
 * differing byte (Req 11.6).
 */
export function constantTimeEqualHex(a: string, b: string): boolean {
  // Equal-length, even-length hex strings are required for a valid byte decode.
  if (a.length !== b.length || a.length % 2 !== 0) {
    return false;
  }
  let bufA: Buffer;
  let bufB: Buffer;
  try {
    bufA = Buffer.from(a, 'hex');
    bufB = Buffer.from(b, 'hex');
  } catch {
    return false;
  }
  // Buffer.from with an odd/invalid hex silently truncates; guard against decode length drift.
  if (bufA.length !== bufB.length || bufA.length === 0) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a provided signature against the recomputed one for the payload + secret.
 *
 * Returns true only when the provided signature is authentic (Req 11.6).
 */
export function verifySignature(
  payload: CallbackPayload,
  providedSignature: unknown,
  secret: string,
): boolean {
  if (typeof providedSignature !== 'string' || providedSignature.length === 0) {
    return false;
  }
  const expected = computeSignature(payload, secret);
  return constantTimeEqualHex(expected, providedSignature.toLowerCase());
}
