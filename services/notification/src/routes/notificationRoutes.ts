/**
 * Notification Service HTTP routes.
 *
 * The service is primarily an event consumer; its HTTP surface is small: a readiness probe and a
 * read-only in-app inbox (the BFF forwards the authenticated user id as `X-User-Id`).
 */

import { HttpStatus } from '@b2b/shared-node';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { NotificationRepository } from '../repositories/types.js';

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

export interface NotificationRouterDeps {
  notifications: NotificationRepository;
  /** Readiness check — resolves true when datastore + broker are reachable (Req 20.1). */
  checkReadiness: () => Promise<{ database: boolean; redis: boolean }>;
}

export function createNotificationRouter(deps: NotificationRouterDeps): Router {
  const router = Router();
  const { notifications, checkReadiness } = deps;

  // GET /health — readiness probe (Req 20.1).
  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const checks = await checkReadiness();
      const ok = checks.database && checks.redis;
      res.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
        status: ok ? 'ok' : 'degraded',
        service: 'notification',
        checks: {
          database: checks.database ? 'up' : 'down',
          redis: checks.redis ? 'up' : 'down',
        },
      });
    }),
  );

  // GET /notifications — the authenticated user's in-app inbox (Req 14.1).
  router.get(
    '/notifications',
    asyncHandler(async (req, res) => {
      const userId = req.header('X-User-Id') ?? '';
      if (userId.trim() === '') {
        res.status(HttpStatus.OK).json({ notifications: [] });
        return;
      }
      const rows = (await notifications.listForUser(userId)).filter((n) => n.channel === 'IN_APP');
      res.status(HttpStatus.OK).json({ notifications: rows });
    }),
  );

  return router;
}
