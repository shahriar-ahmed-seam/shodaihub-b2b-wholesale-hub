/**
 * RS256 key material resolution (design: Security → JWT, Req 19.4).
 *
 * Production/staging supply PEM keys via `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` (secrets store,
 * never source). When both are absent — local dev and the automated test-suite — an ephemeral
 * 2048-bit RSA keypair is generated in-process so token issuance/verification works end-to-end
 * without external setup. The fallback is logged loudly and must never be relied on in production.
 */

import { generateKeyPairSync } from 'node:crypto';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  /** True when the pair was generated in-process (no env keys supplied). */
  ephemeral: boolean;
}

export function resolveKeyPair(
  privateKeyPem: string,
  publicKeyPem: string,
): KeyPair {
  if (privateKeyPem.trim() !== '' && publicKeyPem.trim() !== '') {
    return { privateKey: privateKeyPem, publicKey: publicKeyPem, ephemeral: false };
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  return { privateKey, publicKey, ephemeral: true };
}
