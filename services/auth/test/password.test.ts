/**
 * Task 2.3 — Property 37: Passwords are stored only as salted hashes.
 * Validates: Requirements 19.1
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher, isArgon2Hash } from '../src/domain/password.js';

// Real argon2id, but with lighter cost parameters so the suite can run 100+ iterations quickly.
// The salted-hash guarantees under test (salted, not plaintext, verifies, distinct salts) are
// independent of the cost parameters; production uses the library's stronger defaults.
const hasher = new Argon2PasswordHasher({ memoryCost: 4096, timeCost: 2, parallelism: 1 });

// A password generator covering varied lengths and character classes.
const passwordArb = fc.string({ minLength: 8, maxLength: 128 });

describe('Property 37: passwords stored only as salted hashes', () => {
  // Feature: b2b-wholesale-hub, Property 37: For any password, the persisted credential is a
  // salted cryptographic hash that is not equal to the plaintext, verifies against the original
  // password, and differs from the hash of the same password stored for a different account.
  it('hash is a salted argon2id digest, never the plaintext, and verifies', async () => {
    await fc.assert(
      fc.asyncProperty(passwordArb, async (password) => {
        const hash = await hasher.hash(password);
        expect(isArgon2Hash(hash)).toBe(true);
        expect(hash).not.toBe(password);
        expect(hash.includes(password)).toBe(false);
        expect(await hasher.verify(hash, password)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('two accounts with the same password get distinct hashes (per-user random salt)', async () => {
    await fc.assert(
      fc.asyncProperty(passwordArb, async (password) => {
        const a = await hasher.hash(password);
        const b = await hasher.hash(password);
        expect(a).not.toBe(b);
        // Both still verify against the original password.
        expect(await hasher.verify(a, password)).toBe(true);
        expect(await hasher.verify(b, password)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('rejects a wrong password (example-based edge case)', async () => {
    const hash = await hasher.hash('correct horse battery');
    expect(await hasher.verify(hash, 'wrong password')).toBe(false);
  });
});
