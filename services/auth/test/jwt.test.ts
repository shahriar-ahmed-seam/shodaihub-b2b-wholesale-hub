/**
 * Task 2.16 — Property 33: JWT access control is sound.
 * Validates: Requirements 2.1, 2.2
 */

import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ROLES, type Role } from '../src/domain/roles.js';
import { TokenService } from '../src/domain/tokens.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// A second, unrelated keypair used to forge "validly-signed-but-wrong-key" tokens.
const other = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const tokens = new TokenService(privateKey, publicKey, 60);

const claimArb = fc.record({
  userId: fc.uuid(),
  role: fc.constantFrom<Role>(...ROLES),
});

function mutateChar(token: string): string {
  // Flip one character in the payload/signature region so the signature no longer matches.
  const idx = Math.floor(token.length * 0.6);
  const original = token[idx]!;
  const replacement = original === 'A' ? 'B' : 'A';
  return token.slice(0, idx) + replacement + token.slice(idx + 1);
}

describe('Property 33: JWT access control is sound', () => {
  // Feature: b2b-wholesale-hub, Property 33: For any token presented to a protected resource,
  // access is granted only when the token's signature is valid and the token is unexpired;
  // tampered, expired, or malformed tokens yield a rejection.

  it('freshly issued tokens verify and carry the correct claims', () => {
    fc.assert(
      fc.property(claimArb, ({ userId, role }) => {
        const token = tokens.issueAccessToken(userId, role);
        const result = tokens.verifyAccessToken(token);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.claims.sub).toBe(userId);
          expect(result.claims.role).toBe(role);
          expect(result.claims.exp).toBeGreaterThan(result.claims.iat);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('tampered tokens are rejected', () => {
    fc.assert(
      fc.property(claimArb, ({ userId, role }) => {
        const token = tokens.issueAccessToken(userId, role);
        const tampered = mutateChar(token);
        fc.pre(tampered !== token);
        expect(tokens.verifyAccessToken(tampered).valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('expired tokens are rejected with an expiry reason', () => {
    fc.assert(
      fc.property(claimArb, fc.integer({ min: 60, max: 10_000 }), ({ userId, role }, agoSeconds) => {
        const nowSec = Math.floor(Date.now() / 1000);
        const expired = jwt.sign(
          { role, iat: nowSec - agoSeconds - 60, exp: nowSec - agoSeconds },
          privateKey,
          { algorithm: 'RS256', subject: userId },
        );
        const result = tokens.verifyAccessToken(expired);
        expect(result.valid).toBe(false);
        if (!result.valid) expect(result.reason).toBe('expired');
      }),
      { numRuns: 100 },
    );
  });

  it('tokens signed by the wrong key are rejected', () => {
    fc.assert(
      fc.property(claimArb, ({ userId, role }) => {
        const forged = jwt.sign({ role }, other.privateKey, {
          algorithm: 'RS256',
          subject: userId,
          expiresIn: 3600,
        });
        expect(tokens.verifyAccessToken(forged).valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('malformed tokens are rejected', () => {
    fc.assert(
      fc.property(fc.string(), (garbage) => {
        expect(tokens.verifyAccessToken(garbage).valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
