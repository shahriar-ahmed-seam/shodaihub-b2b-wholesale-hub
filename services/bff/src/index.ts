/**
 * API Gateway / BFF entrypoint.
 *
 * Loads env-driven config, resolves the RS256 verification key (with an ephemeral fallback for
 * local/test use only), builds the Express app, and starts listening. The Next.js frontend talks
 * only to this service; internal service ports are not publicly reachable (design: Architecture).
 */

import { createLogger } from '@b2b/shared-node';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { resolveVerificationKey } from './domain/keys.js';

function main(): void {
  const config = loadConfig();
  const logger = createLogger({ service: 'bff', level: config.logLevel as never });

  const key = resolveVerificationKey(config.jwtPublicKey);
  if (key.ephemeral) {
    logger.warn(
      'JWT_PUBLIC_KEY not set — generated an EPHEMERAL RS256 keypair for local/test use only. ' +
        'Tokens signed elsewhere will NOT verify. Never run this way in production.',
    );
  }

  const app = buildApp({ config, publicKey: key.publicKey, logger });

  app.listen(config.port, () => {
    logger.info('BFF listening', {
      port: config.port,
      services: config.serviceUrls,
      nodeEnv: config.nodeEnv,
    });
  });
}

main();
