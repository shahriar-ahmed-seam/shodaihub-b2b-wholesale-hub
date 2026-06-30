/**
 * Payment Gateway entrypoint.
 *
 * Loads config, connects to Postgres, applies migrations, builds the app over the `pg`-backed
 * repositories with the HTTP Inventory client and the Redis Streams event publisher, starts a
 * periodic timeout sweep (Req 11.4), and starts listening (Req 20.1).
 */

import { createLogger } from '@b2b/shared-node';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { HttpInventoryClient } from './clients/inventoryClient.js';
import { closePool, getPool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { RedisStreamPublisher } from './events/publisher.js';
import { ProviderRegistry } from './providers/registry.js';
import { createPgRepositories } from './repositories/pg.js';
import { PaymentService } from './services/paymentService.js';
import { systemClock } from './services/clock.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ service: 'payment', level: config.logLevel as never });

  const pool = getPool(config.databaseUrl);
  try {
    const applied = await runMigrations(pool);
    logger.info('Migrations checked', { applied });
  } catch (err) {
    logger.error('Migration run failed at startup', { error: String(err) });
  }

  const timeoutMs = config.timeoutMinutes * 60 * 1000;
  const paymentService = new PaymentService({
    repositories: createPgRepositories(pool),
    providers: new ProviderRegistry(config.providerSecrets),
    inventory: new HttpInventoryClient({ baseUrl: config.inventoryServiceUrl }),
    events: new RedisStreamPublisher({ url: config.redisUrl, logger }),
    clock: systemClock,
    logger,
    timeoutMs,
  });

  const checkDatabase = async (): Promise<boolean> => {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  };

  // Periodic timeout sweep: un-applied PENDING transactions older than the window time out so
  // sub-orders stay PENDING and reservations expire naturally (Req 11.4).
  const sweepIntervalMs = Math.max(30_000, Math.floor(timeoutMs / 5));
  const sweep = setInterval(() => {
    paymentService
      .sweepTimeouts()
      .then((ids) => {
        if (ids.length > 0) logger.info('Timed out stale transactions', { count: ids.length });
      })
      .catch((err) => logger.error('Timeout sweep failed', { error: String(err) }));
  }, sweepIntervalMs);
  sweep.unref();

  const app = buildApp({ paymentService, checkDatabase, logger });
  const server = app.listen(config.port, () => {
    logger.info('Payment Gateway listening', { port: config.port });
  });

  const shutdown = (signal: string): void => {
    logger.info('Shutting down', { signal });
    clearInterval(sweep);
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(JSON.stringify({ message: 'Payment Gateway failed to start', error: String(err) }));
  process.exitCode = 1;
});
