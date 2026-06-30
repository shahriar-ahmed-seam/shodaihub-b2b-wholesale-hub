/**
 * Password hashing (Req 19.1, design: Security → Password storage).
 *
 * Passwords are stored only as argon2id hashes with a per-user random salt (argon2 embeds a fresh
 * random salt in every hash). Plaintext is never persisted or logged. Property 37 verifies these
 * guarantees.
 *
 * The {@link PasswordHasher} interface lets the service depend on an abstraction: production uses
 * {@link Argon2PasswordHasher}; fast deterministic fakes can be substituted in property tests that
 * exercise unrelated logic at high iteration counts.
 */

import argon2 from 'argon2';

export interface PasswordHasher {
  hash(plaintext: string): Promise<string>;
  verify(hash: string, plaintext: string): Promise<boolean>;
}

/** argon2id cost parameters. Defaults follow the argon2 library's recommended defaults. */
export interface Argon2Options {
  memoryCost?: number;
  timeCost?: number;
  parallelism?: number;
}

export class Argon2PasswordHasher implements PasswordHasher {
  private readonly options: argon2.Options & { raw?: false };

  constructor(options: Argon2Options = {}) {
    this.options = { type: argon2.argon2id, ...options };
  }

  /** Hash a plaintext password. argon2id with a fresh random salt per call. */
  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, this.options);
  }

  /** Constant-time verify of a candidate plaintext against a stored hash. */
  async verify(hash: string, plaintext: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      // Malformed/garbage hash → not a match (never throw plaintext-bearing errors upward).
      return false;
    }
  }
}

/** Returns true when a stored credential looks like an argon2 hash (defense-in-depth check). */
export function isArgon2Hash(value: string): boolean {
  return /^\$argon2(id|i|d)\$/.test(value);
}
