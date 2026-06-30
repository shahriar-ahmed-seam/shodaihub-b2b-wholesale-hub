/**
 * Auth Service HTTP routes (design: API Surface → Auth Service).
 *
 * Thin controllers: parse/forward to {@link AuthService}, set status codes, and delegate all error
 * rendering to the shared error-handling middleware. Refresh tokens are exchanged in the JSON body
 * here (the BFF maps them to httpOnly cookies at the edge).
 */

import { HttpStatus } from '@b2b/shared-node';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { TokenService } from '../domain/tokens.js';
import { requireAuth, requireRole, type AuthenticatedRequestFields } from '../middleware/authGuard.js';
import type { AuthService } from '../services/authService.js';

/** Wrap an async handler so rejected promises reach the Express error pipeline. */
function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

export interface AuthRouterDeps {
  authService: AuthService;
  tokens: TokenService;
  /** Readiness check — resolves true when the datastore is reachable (Req 20.1). */
  checkDatabase: () => Promise<boolean>;
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();
  const { authService, tokens, checkDatabase } = deps;

  // GET /auth/health — readiness probe (Req 20.1).
  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const dbOk = await checkDatabase();
      const status = dbOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
      res.status(status).json({
        status: dbOk ? 'ok' : 'degraded',
        service: 'auth',
        checks: { database: dbOk ? 'up' : 'down' },
      });
    }),
  );

  // POST /auth/register (Req 1.1, 1.2, 1.3, 1.8).
  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const user = await authService.register(req.body ?? {});
      res.status(HttpStatus.CREATED).json({ user });
    }),
  );

  // POST /auth/login (Req 1.4, 1.5, 1.7, 1.10).
  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const { email, password } = req.body ?? {};
      const result = await authService.login(String(email ?? ''), String(password ?? ''));
      res.status(HttpStatus.OK).json(result);
    }),
  );

  // POST /auth/refresh (Req 1.6, 1.9).
  router.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      const { refreshToken } = req.body ?? {};
      const pair = await authService.refresh(String(refreshToken ?? ''));
      res.status(HttpStatus.OK).json(pair);
    }),
  );

  // POST /auth/logout (Req 1.6).
  router.post(
    '/logout',
    requireAuth(tokens),
    asyncHandler(async (req, res) => {
      const { refreshToken } = req.body ?? {};
      await authService.logout(String(refreshToken ?? ''));
      res.status(HttpStatus.NO_CONTENT).send();
    }),
  );

  // GET /auth/me (Req 2.1).
  router.get(
    '/me',
    requireAuth(tokens),
    asyncHandler(async (req, res) => {
      const { userId } = (req as Request & Required<AuthenticatedRequestFields>).auth;
      const user = await authService.me(userId);
      res.status(HttpStatus.OK).json({ user });
    }),
  );

  // POST /auth/admin/users/:id/suspend (Req 16.2, 16.3).
  router.post(
    '/admin/users/:id/suspend',
    requireAuth(tokens),
    requireRole('ADMINISTRATOR'),
    asyncHandler(async (req, res) => {
      const actor = (req as Request & Required<AuthenticatedRequestFields>).auth;
      const targetId = req.params.id!;
      const user = await authService.suspendUser(targetId);
      await authService.recordAccessDecision(actor.userId, true, {
        action: 'suspend_user',
        targetUserId: targetId,
      });
      res.status(HttpStatus.OK).json({ user });
    }),
  );

  return router;
}
