/**
 * Inventory Service client (Req 11.2, 11.3, 11.9).
 *
 * The Payment Gateway depends only on this interface so its logic can be property-tested against
 * an in-memory fake without a live Inventory Service. Production wires {@link HttpInventoryClient}
 * which calls the Inventory Service over HTTP (`INVENTORY_SERVICE_URL`), propagating the
 * correlation id for end-to-end tracing.
 */

import { CORRELATION_ID_HEADER, AppError, HttpStatus } from '@b2b/shared-node';

/** Order total as reported by the Inventory Service, always in BDT (Req 11.2). */
export interface OrderTotal {
  orderId: string;
  /** Canonical BDT amount string. */
  amount: string;
  currency: 'BDT';
}

/**
 * Result of asking the Inventory Service to confirm an order against a successful payment.
 *
 * - `CONFIRMED`         — reservations were converted to permanent decrements; sub-orders CONFIRMED (Req 11.3).
 * - `INSUFFICIENT_STOCK` — reservations had expired and sellable stock was insufficient (Req 11.9);
 *                          sub-orders remain PENDING and the transaction must be flagged for reconciliation.
 */
export interface ConfirmResult {
  outcome: 'CONFIRMED' | 'INSUFFICIENT_STOCK';
  /** Retailer who placed the order — recipient of the payment-confirmation notification (Req 11.5). */
  retailerId?: string;
  /** Suppliers with a sub-order in this order — recipients of new-order notifications (Req 11.5). */
  supplierIds?: string[];
}

export interface InventoryClient {
  /** Fetch the full order total in BDT (Req 11.2). */
  getOrderTotal(orderId: string, correlationId: string): Promise<OrderTotal>;
  /** Confirm the order on authentic payment success (Req 11.3, 11.9). */
  confirmOrder(orderId: string, txnId: string, correlationId: string): Promise<ConfirmResult>;
}

export interface HttpInventoryClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** HTTP-backed Inventory client using the Node 20 global `fetch`. */
export class HttpInventoryClient implements InventoryClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly doFetch: typeof fetch;

  constructor(options: HttpInventoryClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.doFetch = options.fetchImpl ?? fetch;
  }

  async getOrderTotal(orderId: string, correlationId: string): Promise<OrderTotal> {
    const body = await this.request<{ orderId?: string; amount?: string | number; currency?: string }>(
      'GET',
      `/internal/orders/${encodeURIComponent(orderId)}/total`,
      correlationId,
    );
    if (body.amount === undefined) {
      throw new AppError(HttpStatus.BAD_GATEWAY, 'INVENTORY_BAD_RESPONSE', 'Inventory returned no order total');
    }
    return {
      orderId,
      amount: typeof body.amount === 'number' ? body.amount.toFixed(2) : String(body.amount),
      currency: 'BDT',
    };
  }

  async confirmOrder(orderId: string, txnId: string, correlationId: string): Promise<ConfirmResult> {
    const body = await this.request<{
      outcome?: string;
      retailerId?: string;
      supplierIds?: string[];
    }>('POST', `/internal/orders/${encodeURIComponent(orderId)}/confirm`, correlationId, { txnId });
    const outcome = body.outcome === 'INSUFFICIENT_STOCK' ? 'INSUFFICIENT_STOCK' : 'CONFIRMED';
    return {
      outcome,
      retailerId: body.retailerId,
      supplierIds: Array.isArray(body.supplierIds) ? body.supplierIds : [],
    };
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    correlationId: string,
    jsonBody?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.doFetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          [CORRELATION_ID_HEADER]: correlationId,
        },
        body: jsonBody === undefined ? undefined : JSON.stringify(jsonBody),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new AppError(
          HttpStatus.BAD_GATEWAY,
          'INVENTORY_ERROR',
          `Inventory Service responded ${res.status} for ${method} ${path}`,
        );
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const aborted = err instanceof Error && err.name === 'AbortError';
      throw new AppError(
        aborted ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY,
        aborted ? 'INVENTORY_TIMEOUT' : 'INVENTORY_UNAVAILABLE',
        `Inventory Service ${aborted ? 'timed out' : 'is unavailable'} for ${method} ${path}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
