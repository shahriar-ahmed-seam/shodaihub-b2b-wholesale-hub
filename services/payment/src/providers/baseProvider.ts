/**
 * Shared base for the provider adapters.
 *
 * All three Bangladeshi providers in scope (bKash, Nagad, SSLCommerz) use an HMAC-SHA256 signature
 * over a canonical payload for callback authenticity; they differ only in identity/secret material
 * and the shape of the (sandbox) checkout URL. This base centralizes the signature scheme so each
 * concrete adapter is a thin specialization.
 */

import type { Provider } from '../domain/providers.js';
import {
  computeSignature,
  verifySignature,
  type CallbackPayload,
} from '../domain/signature.js';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
} from './types.js';

export interface ProviderCredentials {
  id: string;
  secret: string;
}

export abstract class BaseProvider implements PaymentProvider {
  abstract readonly name: Provider;
  /** Base URL of the provider's (sandbox) hosted-checkout endpoint. */
  protected abstract readonly checkoutBaseUrl: string;

  constructor(protected readonly credentials: ProviderCredentials) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    // Sandbox-friendly: build a deterministic hosted-checkout URL. A real adapter would POST to the
    // provider's create-payment API here using `this.credentials` and return the redirect URL.
    const params = new URLSearchParams({
      merchant: this.credentials.id,
      txnId: input.txnId,
      orderId: input.orderId,
      amount: input.amount,
      currency: 'BDT',
    });
    return { checkoutUrl: `${this.checkoutBaseUrl}?${params.toString()}` };
  }

  sign(payload: CallbackPayload): string {
    return computeSignature(payload, this.credentials.secret);
  }

  verify(payload: CallbackPayload, providedSignature: unknown): boolean {
    return verifySignature(payload, providedSignature, this.credentials.secret);
  }
}
