/** Nagad provider adapter (sandbox-friendly). */

import type { Provider } from '../domain/providers.js';
import { BaseProvider } from './baseProvider.js';

export class NagadProvider extends BaseProvider {
  readonly name: Provider = 'nagad';
  protected readonly checkoutBaseUrl = 'https://sandbox.nagad.example/checkout';
}
