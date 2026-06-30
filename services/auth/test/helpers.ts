/**
 * Shared test scaffolding: builds an AuthService over in-memory repositories with a controllable
 * clock and a fast deterministic password hasher, so the property suites can run many iterations
 * without a live Postgres or the cost of argon2 (the real hasher is exercised directly by the
 * Property 37 suite).
 */

import { createHash, randomBytes } from 'node:crypto';
import { generateKeyPairSync } from 'node:crypto';
import type { PasswordHasher } from '../src/domain/password.js';
import { TokenService } from '../src/domain/tokens.js';
import {
  createInMemoryRepositories,
  type InMemoryAuditLogRepository,
} from '../src/repositories/memory.js';
import type { Repositories } from '../src/repositories/types.js';
import { AuthService } from '../src/services/authService.js';
import { FixedClock } from '../src/services/clock.js';

/** Fast, salted, deterministic hasher for tests unrelated to hashing security. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(plaintext: string): Promise<string> {
    const salt = randomBytes(8).toString('hex');
    const digest = createHash('sha256').update(salt + plaintext).digest('hex');
    return `fake$${salt}$${digest}`;
  }

  async verify(hash: string, plaintext: string): Promise<boolean> {
    const parts = hash.split('$');
    if (parts.length !== 3 || parts[0] !== 'fake') return false;
    const salt = parts[1]!;
    const expected = createHash('sha256').update(salt + plaintext).digest('hex');
    return parts[2] === expected;
  }
}

let cachedKeys: { privateKey: string; publicKey: string } | null = null;
function testKeys(): { privateKey: string; publicKey: string } {
  if (!cachedKeys) {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    cachedKeys = { privateKey, publicKey };
  }
  return cachedKeys;
}

export interface Harness {
  service: AuthService;
  repos: Repositories & { auditLog: InMemoryAuditLogRepository };
  clock: FixedClock;
  tokens: TokenService;
  hasher: PasswordHasher;
}

export interface HarnessOptions {
  startTime?: number;
  hasher?: PasswordHasher;
  accessTtlMinutes?: number;
  refreshTtlDays?: number;
  lockoutThreshold?: number;
  lockoutWindowMinutes?: number;
}

export function makeHarness(options: HarnessOptions = {}): Harness {
  const clock = new FixedClock(options.startTime ?? Date.UTC(2025, 0, 1, 0, 0, 0));
  const repos = createInMemoryRepositories();
  const keys = testKeys();
  const tokens = new TokenService(keys.privateKey, keys.publicKey, options.accessTtlMinutes ?? 60);
  const hasher = options.hasher ?? new FakePasswordHasher();
  const service = new AuthService({
    repositories: repos,
    passwordHasher: hasher,
    tokens,
    clock,
    lockoutPolicy: {
      threshold: options.lockoutThreshold ?? 5,
      windowMs: (options.lockoutWindowMinutes ?? 15) * 60 * 1000,
    },
    refreshTtlDays: options.refreshTtlDays ?? 7,
  });
  return { service, repos, clock, tokens, hasher };
}

/** Register a user and force it ACTIVE (the verification flow is out of scope for the Auth tests). */
export async function makeActiveUser(
  h: Harness,
  email: string,
  password: string,
  role: 'SUPPLIER' | 'RETAILER' | 'ADMINISTRATOR' = 'RETAILER',
): Promise<string> {
  const user = await h.service.register({ email, password, businessName: 'Acme Co', role });
  await h.repos.users.updateStatus(user.id, 'ACTIVE');
  return user.id;
}
