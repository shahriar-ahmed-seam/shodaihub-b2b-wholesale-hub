/**
 * Express application factory.
 *
 * Wires the shared correlation-id middleware + structured logger, JSON body parsing with a size
 * limit (Req 19.3), the payment routes, and the shared error pipeline. Dependencies are injected so
 * the same app can run over Postgres in production or in-memory fakes in tests.
 */

import { correlationId, createLogger, type Logger } from '@b2b/shared-node';
import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createPaymentRouter } from './routes/paymentRoutes.js';
import type { PaymentService } from './services/paymentService.js';

export interface AppDeps {
  paymentService: PaymentService;
  checkDatabase: () => Promise<boolean>;
  logger?: Logger;
}

export function buildApp(deps: AppDeps): Express {
  const logger = deps.logger ?? createLogger({ service: 'payment' });
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use(correlationId({ logger }));

  app.use(
    '/payments',
    createPaymentRouter({
      paymentService: deps.paymentService,
      checkDatabase: deps.checkDatabase,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
