/**
 * Provider registry — resolves a {@link PaymentProvider} adapter by name (Req 11.1).
 *
 * Constructed from per-provider credentials (sourced from the secrets store via config). The
 * service layer asks the registry for the single adapter bound to a transaction.
 */

import { AppError, HttpStatus } from '@b2b/shared-node';
import type { ProviderSecrets } from '../config.js';
import { PROVIDERS, type Provider } from '../domain/providers.js';
import { BkashProvider } from './bkash.js';
import { NagadProvider } from './nagad.js';
import { SslcommerzProvider } from './sslcommerz.js';
import type { PaymentProvider } from './types.js';

export class ProviderRegistry {
  private readonly providers: Record<Provider, PaymentProvider>;

  constructor(secrets: Record<Provider, ProviderSecrets>) {
    this.providers = {
      bkash: new BkashProvider(secrets.bkash),
      nagad: new NagadProvider(secrets.nagad),
      sslcommerz: new SslcommerzProvider(secrets.sslcommerz),
    };
  }

  /** Resolve the adapter for a supported provider, or throw a validation error. */
  get(provider: Provider): PaymentProvider {
    const adapter = this.providers[provider];
    if (!adapter) {
      throw new AppError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'UNSUPPORTED_PROVIDER',
        `Payment provider must be one of: ${PROVIDERS.join(', ')}`,
      );
    }
    return adapter;
  }
}
