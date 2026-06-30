/**
 * Auth Service entrypoint.
 *
 * Loads config, resolves RS256 keys (env or ephemeral dev fallback), connects to Postgres, applies
 * migrations, builds the app over the `pg`-backed repositories, and starts listening (Req 20.1).
 */

import { createLogger } from '@b2b/shared-node';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { resolveKeyPair } from './domain/keys.js';
import { Argon2PasswordHasher } from './domain/password.js';
import { TokenService } from './domain/tokens.js';
import { closePool, getPool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { createPgRepositories } from './repositories/pg.js';
import { AuthService } from './services/authService.js';
import { systemClock } from './services/clock.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ service: 'auth', level: config.logLevel as never });

  const keys = resolveKeyPair(config.jwtPrivateKey, config.jwtPublicKey);
  if (keys.ephemeral) {
    logger.warn(
      'No JWT_PRIVATE_KEY/JWT_PUBLIC_KEY supplied — generated an EPHEMERAL RS256 keypair. ' +
        'Tokens will not survive restarts. Set keys via the secrets store for any shared environment.',
    );
  }

  const pool = getPool(config.databaseUrl);

  try {
    const applied = await runMigrations(pool);
    logger.info('Migrations checked', { applied });
  } catch (err) {
    logger.error('Migration run failed at startup', { error: String(err) });
  }

  const tokens = new TokenService(keys.privateKey, keys.publicKey, config.accessTokenTtlMinutes);
  const authService = new AuthService({
    repositories: createPgRepositories(pool),
    passwordHasher: new Argon2PasswordHasher(),
    tokens,
    clock: systemClock,
    lockoutPolicy: {
      threshold: config.lockoutThreshold,
      windowMs: config.lockoutWindowMinutes * 60 * 1000,
    },
    refreshTtlDays: config.refreshTokenTtlDays,
  });

  const checkDatabase = async (): Promise<boolean> => {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  };

  const app = buildApp({ authService, tokens, checkDatabase, logger });
  const server = app.listen(config.port, () => {
    logger.info('Auth Service listening', { port: config.port });
  });

  const shutdown = (signal: string): void => {
    logger.info('Shutting down', { signal });
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(JSON.stringify({ message: 'Auth Service failed to start', error: String(err) }));
  process.exitCode = 1;
});
