/**
 * RS256 verification-key resolution for the BFF (design: Security → JWT, Req 19.4).
 *
 * The BFF only *verifies* access tokens, so in production it needs just the PUBLIC key supplied
 * via `JWT_PUBLIC_KEY` (secrets store, never source). When the key is absent — local dev and the
 * automated test-suite — an ephemeral 2048-bit RSA keypair is generated in-process so the gateway
 * can verify tokens end-to-end without external setup. The private half of the ephemeral pair is
 * exposed so tests (and a local Auth stub) can mint tokens the BFF will accept. The fallback must
 * never be relied on in production and is logged loudly by the entrypoint.
 */

import { generateKeyPairSync } from 'node:crypto';

export interface VerificationKey {
  publicKey: string;
  /**
   * Present only for the ephemeral fallback so tests/local tooling can sign tokens the BFF
   * verifies. Never populated when a real `JWT_PUBLIC_KEY` is supplied (the BFF holds no private
   * key in production).
   */
  privateKey?: string;
  /** True when the key was generated in-process (no env key supplied). */
  ephemeral: boolean;
}

export function resolveVerificationKey(publicKeyPem: string): VerificationKey {
  if (publicKeyPem.trim() !== '') {
    return { publicKey: publicKeyPem, ephemeral: false };
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  return { publicKey, privateKey, ephemeral: true };
}
