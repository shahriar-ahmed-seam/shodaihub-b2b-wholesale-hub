/**
 * Shared test scaffolding: builds a PaymentService over in-memory repositories with a controllable
 * clock, a fake Inventory client, and an in-memory event publisher, so the property suites can run
 * many iterations without a live Postgres, Inventory Service, or Redis.
 */

import { createLogger } from '@b2b/shared-node';
import type {
  ConfirmResult,
  InventoryClient,
  OrderTotal,
} from '../src/clients/inventoryClient.js';
import type { Provider } from '../src/domain/providers.js';
import { computeSignature, type CallbackPayload } from '../src/domain/signature.js';
import { NOTIFICATIONS_STREAM } from '../src/events/types.js';
import { InMemoryEventPublisher } from '../src/events/publisher.js';
import { ProviderRegistry } from '../src/providers/registry.js';
import {
  createInMemoryRepositories,
  type InMemoryPaymentTransactionRepository,
  type InMemoryRejectedCallbackRepository,
} from '../src/repositories/memory.js';
import { PaymentService } from '../src/services/paymentService.js';
import { FixedClock } from '../src/services/clock.js';
import type { ProviderSecrets } from '../src/config.js';

/** Deterministic provider secrets for tests. */
export const TEST_SECRETS: Record<Provider, ProviderSecrets> = {
  bkash: { id: 'bkash-test-id', secret: 'bkash-test-secret' },
  nagad: { id: 'nagad-test-id', secret: 'nagad-test-secret' },
  sslcommerz: { id: 'ssl-test-id', secret: 'ssl-test-secret' },
};

/**
 * Configurable fake Inventory client.
 *
 * Records calls so tests can assert confirm-call count (idempotency, Property 27) and that confirm
 * is/ isn't called (Property 28). The order total and confirm outcome are configurable.
 */
export class FakeInventoryClient implements InventoryClient {
  totalsByOrder = new Map<string, string>();
  defaultTotal = '100.00';
  confirmOutcome: ConfirmResult['outcome'] = 'CONFIRMED';
  retailerId = 'retailer-1';
  supplierIds = ['supplier-1', 'supplier-2'];

  getOrderTotalCalls: string[] = [];
  confirmCalls: Array<{ orderId: string; txnId: string }> = [];

  async getOrderTotal(orderId: string): Promise<OrderTotal> {
    this.getOrderTotalCalls.push(orderId);
    const amount = this.totalsByOrder.get(orderId) ?? this.defaultTotal;
    return { orderId, amount, currency: 'BDT' };
  }

  async confirmOrder(orderId: string, txnId: string): Promise<ConfirmResult> {
    this.confirmCalls.push({ orderId, txnId });
    return {
      outcome: this.confirmOutcome,
      retailerId: this.retailerId,
      supplierIds: this.supplierIds,
    };
  }
}

export interface Harness {
  service: PaymentService;
  repos: ReturnType<typeof createInMemoryRepositories> & {
    transactions: InMemoryPaymentTransactionRepository;
    rejectedCallbacks: InMemoryRejectedCallbackRepository;
  };
  inventory: FakeInventoryClient;
  events: InMemoryEventPublisher;
  providers: ProviderRegistry;
  clock: FixedClock;
}

export interface HarnessOptions {
  startTime?: number;
  timeoutMinutes?: number;
}

export function makeHarness(options: HarnessOptions = {}): Harness {
  const clock = new FixedClock(options.startTime ?? Date.UTC(2025, 0, 1, 0, 0, 0));
  const repos = createInMemoryRepositories();
  const inventory = new FakeInventoryClient();
  const events = new InMemoryEventPublisher();
  const providers = new ProviderRegistry(TEST_SECRETS);
  const service = new PaymentService({
    repositories: repos,
    providers,
    inventory,
    events,
    clock,
    logger: createLogger({ service: 'payment-test', level: 'error', sink: () => {} }),
    timeoutMs: (options.timeoutMinutes ?? 5) * 60 * 1000,
  });
  return { service, repos, inventory, events, providers, clock };
}

/** Build a callback body with a valid signature for the given provider's test secret. */
export function signedCallbackBody(
  provider: Provider,
  payload: CallbackPayload,
): Record<string, unknown> {
  const signature = computeSignature(payload, TEST_SECRETS[provider].secret);
  return { ...payload, signature };
}

export { NOTIFICATIONS_STREAM };
