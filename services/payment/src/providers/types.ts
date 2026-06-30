/**
 * Provider-agnostic payment facade (Req 11.1).
 *
 * The service layer talks only to this interface; concrete adapters for bKash, Nagad, and
 * SSLCommerz implement it. This keeps provider-specific details (checkout creation, signature
 * scheme) behind a single seam that can be faked in tests and swapped per environment.
 */

import type { Provider } from '../domain/providers.js';
import type { CallbackPayload } from '../domain/signature.js';

export interface CreateCheckoutInput {
  txnId: string;
  orderId: string;
  /** Canonical BDT amount string. */
  amount: string;
}

export interface CreateCheckoutResult {
  /** Provider-hosted URL the retailer is redirected to in order to complete payment. */
  checkoutUrl: string;
}

/**
 * A single payment provider adapter.
 *
 * Implementations are mock/sandbox-friendly: {@link PaymentProvider.createCheckout} returns a
 * deterministic sandbox URL and never performs real network calls in local/test, while the
 * signature methods implement the real callback-authenticity scheme (Req 11.6).
 */
export interface PaymentProvider {
  readonly name: Provider;
  /** Create a provider checkout session for a bound transaction. */
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  /** Compute the expected callback signature for a payload (used by the sandbox + tests). */
  sign(payload: CallbackPayload): string;
  /** Verify a provided callback signature in constant time (Req 11.6). */
  verify(payload: CallbackPayload, providedSignature: unknown): boolean;
}
