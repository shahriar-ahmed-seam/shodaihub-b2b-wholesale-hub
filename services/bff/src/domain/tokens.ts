/**
 * Access-token verification at the edge (design: Security → JWT; Req 2.1, 2.2).
 *
 * The BFF verifies the RS256 access token's signature + expiry exactly *once* per request and
 * forwards the resolved identity to upstream services as headers, so internal services never
 * re-validate the signature. Verification is isolated here as a pure, side-effect-free unit so it
 * can be property-tested over valid, tampered, expired, and malformed tokens (Property 33/34).
 *
 * The verifier never throws: every failure is reported as a typed result.
 */

import jwt from 'jsonwebtoken';
import { isRole, type Role } from './roles.js';

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

export class TokenVerifier {
  private readonly publicKey: string;

  constructor(publicKey: string) {
    this.publicKey = publicKey;
  }

  /**
   * Verify an access token's signature + expiry (Req 2.1). Tampered, expired, malformed, or
   * wrong-key tokens are rejected (Req 2.2). Tokens whose role claim is not one of the three
   * platform roles are treated as invalid.
   */
  verifyAccessToken(token: string): VerifyResult {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
      }) as jwt.JwtPayload;

      if (
        typeof decoded.sub !== 'string' ||
        !isRole(decoded.role) ||
        typeof decoded.iat !== 'number' ||
        typeof decoded.exp !== 'number'
      ) {
        return { valid: false, reason: 'invalid' };
      }

      return {
        valid: true,
        claims: {
          sub: decoded.sub,
          role: decoded.role,
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

/** Extract a bearer token from an `Authorization` header value, or `null` when absent/malformed. */
export function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1]!.trim() : null;
}
