/**
 * Token issuance and verification (design: Security → JWT; Req 1.4, 1.6, 1.9, 2.1, 2.2).
 *
 *  - Access tokens are RS256-signed JWTs carrying `sub` (user id), `role`, `iat`, `exp` (60 min).
 *  - Refresh tokens are opaque high-entropy strings; only their SHA-256 hash is persisted, and
 *    they are rotated (old one revoked) on every use.
 *
 * The signing/verification logic is isolated here so it can be property-tested over valid,
 * tampered, expired, and malformed tokens (Property 33) and rotation behaviour (Property 35).
 */

import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from './roles.js';

export interface AccessTokenClaims {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface VerifyOk {
  valid: true;
  claims: AccessTokenClaims;
}
export interface VerifyFail {
  valid: false;
  reason: 'expired' | 'invalid';
}
export type VerifyResult = VerifyOk | VerifyFail;

export class TokenService {
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly accessTtlSeconds: number;

  constructor(privateKey: string, publicKey: string, accessTtlMinutes: number) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.accessTtlSeconds = accessTtlMinutes * 60;
  }

  /** Issue a signed RS256 access token for the user (Req 1.4). */
  issueAccessToken(userId: string, role: Role): string {
    return jwt.sign({ role }, this.privateKey, {
      algorithm: 'RS256',
      subject: userId,
      expiresIn: this.accessTtlSeconds,
    });
  }

  /**
   * Verify an access token's signature + expiry (Req 2.1). Tampered, expired, or malformed tokens
   * are rejected (Req 2.2) — never throws.
   */
  verifyAccessToken(token: string): VerifyResult {
    try {
      const decoded = jwt.verify(token, this.publicKey, { algorithms: ['RS256'] }) as jwt.JwtPayload;
      if (
        typeof decoded.sub !== 'string' ||
        typeof decoded.role !== 'string' ||
        typeof decoded.iat !== 'number' ||
        typeof decoded.exp !== 'number'
      ) {
        return { valid: false, reason: 'invalid' };
      }
      return {
        valid: true,
        claims: {
          sub: decoded.sub,
          role: decoded.role as Role,
          iat: decoded.iat,
          exp: decoded.exp,
        },
      };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return { valid: false, reason: 'expired' };
      }
      return { valid: false, reason: 'invalid' };
    }
  }
}

/** Generate a fresh opaque refresh token (high-entropy, URL-safe). */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

/** Deterministic one-way hash for at-rest storage of refresh tokens (Req 1.6 — stored hashed). */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
