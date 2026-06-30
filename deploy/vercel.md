# Vercel Deployment — Frontend (Next.js 14)

The Next.js frontend (`frontend/`) is hosted on Vercel. Vercel handles TLS, the
CDN, and the build pipeline; it ignores the `output: 'standalone'` Docker setting
and uses its own Next.js builder (Req 20.4, 20.5). HTTPS is terminated at the
Vercel edge (Req 19.2).

## Project settings

This is an npm-workspaces monorepo, so keep the Vercel **Root Directory at the
repository root** (not `frontend/`) so `npm ci` can resolve the workspace graph.
`deploy/vercel.json` encodes the build settings:

| Setting           | Value                              | Why |
|-------------------|------------------------------------|-----|
| Framework         | `nextjs`                           | Enables Next.js build + routing. |
| Install Command   | `npm ci`                           | Installs the whole workspace from the root lockfile. |
| Build Command     | `npm run build -w @b2b/frontend`   | Builds only the frontend workspace. |
| Output Directory  | `frontend/.next`                   | Next build output for the workspace. |

To use `deploy/vercel.json`, either copy/symlink it to the repo root as
`vercel.json`, or set the same four values in the Vercel project UI. The
`headers` block adds baseline security headers (HSTS, nosniff, frame-deny).

## Environment variables

Set these in the Vercel project (Production + Preview as needed). All
environment-specific config is env-driven (Req 20.4):

| Variable              | Example                                | Notes |
|-----------------------|----------------------------------------|-------|
| `NEXT_PUBLIC_BFF_URL` | `https://api.b2b-wholesale-hub.com`    | Public HTTPS URL of the BFF (the only public backend). Baked into the client bundle at build time, so set it before building. |
| `NODE_ENV`            | `production`                           | Set automatically by Vercel for production builds. |

### Default locale

Locale routing is handled by `next-intl` with `/en` and `/bn` segments and an
English fallback for missing keys (see `frontend/src/i18n/`). The default locale
is **`en`**, configured in code (the i18n routing config + middleware), not via a
Vercel env var. To change the default, update the `next-intl` routing config; no
deploy setting is required.

## Deploy flow

1. Connect the GitHub repo to a Vercel project; set Root Directory = repo root.
2. Apply the build settings above (or commit `vercel.json` at the root).
3. Set `NEXT_PUBLIC_BFF_URL` to the deployed BFF origin (Render public URL or the
   Kubernetes Ingress host).
4. Pushes to `main` trigger production deploys; PRs get preview deployments. The
   CI workflow (`.github/workflows/deploy.yml`) also triggers a deploy hook on
   merge to `main` as a backstop.

## CORS / connectivity

The browser calls the BFF directly at `NEXT_PUBLIC_BFF_URL`. Ensure the BFF's
allowed origins include the Vercel production and preview domains.
