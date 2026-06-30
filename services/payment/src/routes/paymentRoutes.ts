/**
 * Payment Gateway HTTP routes (design: API Surface → Payment Gateway).
 *
 * Thin controllers: parse/forward to {@link PaymentService}, set status codes, and delegate all
 * error rendering to the shared error-handling middleware.
 *
 * | POST | /payments/initiate            | initiate payment for an order (Req 11.1, 11.2)        |
 * | POST | /payments/callback/{provider} | verify + idempotently apply a callback (Req 11.3,11.6-11.9) |
 * | GET  | /payments/{txnId}             | payment status (Req 11.4)                             |
 */

import { getCorrelationId, HttpStatus } from '@b2b/shared-node';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { PaymentService } from '../services/paymentService.js';

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

export interface PaymentRouterDeps {
  paymentService: PaymentService;
  /** Readiness check — resolves true when the datastore is reachable (Req 20.1). */
  checkDatabase: () => Promise<boolean>;
}

export function createPaymentRouter(deps: PaymentRouterDeps): Router {
  const router = Router();
  const { paymentService, checkDatabase } = deps;

  // GET /payments/health — readiness probe (Req 20.1).
  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const dbOk = await checkDatabase();
      const status = dbOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
      res.status(status).json({
        status: dbOk ? 'ok' : 'degraded',
        service: 'payment',
        checks: { database: dbOk ? 'up' : 'down' },
      });
    }),
  );

  // POST /payments/initiate (Req 11.1, 11.2).
  router.post(
    '/initiate',
    asyncHandler(async (req, res) => {
      const correlationId = getCorrelationId(req) ?? '';
      const body = (req.body ?? {}) as { orderId?: unknown; provider?: unknown };
      const result = await paymentService.initiate(
        { orderId: body.orderId, provider: body.provider },
        correlationId,
      );
      res.status(HttpStatus.CREATED).json(result);
    }),
  );

  // POST /payments/callback/:provider (Req 11.3, 11.6–11.9).
  router.post(
    '/callback/:provider',
    asyncHandler(async (req, res) => {
      const correlationId = getCorrelationId(req) ?? '';
      const provider = req.params.provider!;
      const result = await paymentService.handleCallback({
        provider,
        body: (req.body ?? {}) as Record<string, unknown>,
        correlationId,
      });
      res.status(result.httpStatus).json({
        outcome: result.outcome,
        applied: result.applied,
        status: result.status,
        ...(result.reason ? { reason: result.reason } : {}),
      });
    }),
  );

  // GET /payments/:txnId (Req 11.4).
  router.get(
    '/:txnId',
    asyncHandler(async (req, res) => {
      const txn = await paymentService.getStatus(req.params.txnId!);
      res.status(HttpStatus.OK).json({
        txnId: txn.txnId,
        orderId: txn.orderId,
        provider: txn.provider,
        amount: txn.amount,
        currency: 'BDT',
        status: txn.status,
        applied: txn.applied,
      });
    }),
  );

  return router;
}
