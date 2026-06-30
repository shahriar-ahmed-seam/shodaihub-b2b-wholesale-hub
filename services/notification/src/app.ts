/**
 * Express application factory.
 *
 * Wires the shared correlation-id middleware + structured logger, JSON body parsing with a size
 * limit (Req 19.3), the notification routes, and the shared error pipeline. Dependencies are
 * injected so the same app can run over Postgres in production or in-memory fakes in tests.
 */

import { correlationId, createLogger, type Logger } from '@b2b/shared-node';
import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createNotificationRouter } from './routes/notificationRoutes.js';
import type { NotificationRepository } from './repositories/types.js';

export interface AppDeps {
  notifications: NotificationRepository;
  checkReadiness: () => Promise<{ database: boolean; redis: boolean }>;
  logger?: Logger;
}

export function buildApp(deps: AppDeps): Express {
  const logger = deps.logger ?? createLogger({ service: 'notification' });
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use(correlationId({ logger }));

  app.use(
    '/',
    createNotificationRouter({
      notifications: deps.notifications,
      checkReadiness: deps.checkReadiness,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
