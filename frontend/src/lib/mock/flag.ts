/**
 * Mock-mode feature flag.
 *
 * The frontend ships with a full client-side mock data layer so the entire site is interactive
 * without any backend (Vercel-ready, frontend only). Mocks are ON by default; set
 * `NEXT_PUBLIC_USE_MOCKS=false` to talk to the real BFF at `NEXT_PUBLIC_BFF_URL` instead.
 *
 * `NEXT_PUBLIC_*` vars are inlined at build time, so this resolves correctly in both server
 * components and the browser bundle.
 */
export function mocksEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';
}
