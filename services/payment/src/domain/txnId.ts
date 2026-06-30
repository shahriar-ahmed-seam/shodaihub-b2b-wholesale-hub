/**
 * Unique payment transaction identifier generation (Req 11.2).
 *
 * Every initiated transaction receives a globally unique id. The id is opaque and URL-safe so it
 * can be used as a path parameter (`GET /payments/{txnId}`).
 */

import { randomUUID } from 'node:crypto';

/** Generate a unique, URL-safe transaction id. */
export function generateTxnId(): string {
  return `txn_${randomUUID()}`;
}
