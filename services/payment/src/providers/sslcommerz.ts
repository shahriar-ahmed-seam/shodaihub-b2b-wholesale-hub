/** SSLCommerz provider adapter (sandbox-friendly). */

import type { Provider } from '../domain/providers.js';
import { BaseProvider } from './baseProvider.js';

export class SslcommerzProvider extends BaseProvider {
  readonly name: Provider = 'sslcommerz';
  protected readonly checkoutBaseUrl = 'https://sandbox.sslcommerz.example/checkout';
}
