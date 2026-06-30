/**
 * Notification Service entrypoint.
 *
 * Loads config, connects to Postgres, applies migrations, builds the channel list + service over
 * the `pg`-backed repositories, connects to Redis and starts the Streams consumer, and exposes the
 * HTTP health/inbox surface (Req 20.1). Startup is resilient: if Redis is unavailable the HTTP
 * server still serves a degraded health response.
 */

import { createLogger } from '@b2b/shared-node';
import { buildApp } from './app.js';
import { buildChannels } from './channels/factory.js';
import { loadConfig } from './config.js';
import { StreamConsumer } from './consumer.js';
import { closePool, getPool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { RedisStreamClient } from './redisStreamClient.js';
import { createPgRepositories } from './repositories/pg.js';
import { NotificationService } from './services/notificationService.js';
import { systemClock } from './services/clock.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ service: 'notification', level: config.logLevel as never });

  const pool = getPool(config.databaseUrl);
  try {
    const applied = await runMigrations(pool);
    logger.info('Migrations checked', { applied });
  } catch (err) {
    logger.error('Migration run failed at startup', { error: String(err) });
  }

  const repositories = createPgRepositories(pool);
  const channels = buildChannels(
    { emailEnabled: config.emailEnabled, smsEnabled: config.smsEnabled },
    logger,
  );
  logger.info('Delivery channels configured', { channels: channels.map((c) => c.name) });

  const service = new NotificationService({
    repositories,
    channels,
    backoff: config.backoff,
    clock: systemClock,
    logger,
  });

  // Connect Redis + start the Streams consumer (best-effort; HTTP serves regardless).
  let redisClient: RedisStreamClient | null = null;
  let consumer: StreamConsumer | null = null;
  try {
    redisClient = await RedisStreamClient.connect(config.redisUrl);
    consumer = new StreamConsumer(
      redisClient,
      service,
      {
        stream: config.stream,
        group: config.consumerGroup,
        consumer: config.consumerName,
      },
      logger,
    );
    void consumer.run();
  } catch (err) {
    logger.error('Redis connection failed at startup; consumer not started', {
      error: String(err),
    });
  }

  const checkReadiness = async (): Promise<{ database: boolean; redis: boolean }> => {
    let database = false;
    try {
      await pool.query('SELECT 1');
      database = true;
    } catch {
      database = false;
    }
    const redis = redisClient ? await redisClient.ping() : false;
    return { database, redis };
  };

  const app = buildApp({ notifications: repositories.notifications, checkReadiness, logger });
  const server = app.listen(config.port, () => {
    logger.info('Notification Service listening', { port: config.port });
  });

  const shutdown = (signal: string): void => {
    logger.info('Shutting down', { signal });
    consumer?.stop();
    server.close(() => {
      void (async () => {
        if (redisClient) await redisClient.close().catch(() => undefined);
        await closePool().catch(() => undefined);
        process.exit(0);
      })();
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(
    JSON.stringify({ message: 'Notification Service failed to start', error: String(err) }),
  );
  process.exitCode = 1;
});
