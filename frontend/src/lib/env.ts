/**
 * Runtime environment access (Req 20.4). The public BFF base URL is the only endpoint the
 * frontend talks to; everything else is proxied behind it. Falls back to the local Compose
 * port so `next dev`/`next build` work without extra configuration.
 */
export const BFF_URL = process.env.NEXT_PUBLIC_BFF_URL?.replace(/\/+$/, '') ?? 'http://localhost:8080';

/** Base path for the public API exposed by the BFF. */
export const API_BASE = `${BFF_URL}/api`;
