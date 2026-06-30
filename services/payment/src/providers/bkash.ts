/** bKash provider adapter (sandbox-friendly). */

import type { Provider } from '../domain/providers.js';
import { BaseProvider } from './baseProvider.js';

export class BkashProvider extends BaseProvider {
  readonly name: Provider = 'bkash';
  protected readonly checkoutBaseUrl = 'https://sandbox.bkash.example/checkout';
}
