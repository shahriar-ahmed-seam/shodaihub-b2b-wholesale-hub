/**
 * Express application factory.
 *
 * Wires the shared correlation-id middleware + structured logger, JSON body parsing with a size
 * limit (Req 19.3), the auth routes, and the shared error pipeline. Dependencies are injected so
 * the same app can run over Postgres in production or in-memory fakes in tests.
 */

import { correlationId, createLogger, type Logger } from '@b2b/shared-node';
import express, { type Express } from 'express';
import type { TokenService } from './domain/tokens.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createAuthRouter } from './routes/authRoutes.js';
import type { AuthService } from './services/authService.js';

export interface AppDeps {
  authService: AuthService;
  tokens: TokenService;
  checkDatabase: () => Promise<boolean>;
  logger?: Logger;
}

export function buildApp(deps: AppDeps): Express {
  const logger = deps.logger ?? createLogger({ service: 'auth' });
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use(correlationId({ logger }));

  app.use(
    '/auth',
    createAuthRouter({
      authService: deps.authService,
      tokens: deps.tokens,
      checkDatabase: deps.checkDatabase,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
