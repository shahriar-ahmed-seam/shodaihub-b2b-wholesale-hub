# syntax=docker/dockerfile:1
# ============================================================================
# Frontend — multi-stage production image (Next.js 14 App Router).
#
# IMPORTANT: build with the REPOSITORY ROOT as the context, because the app is an
# npm workspace and the standalone output traces from the monorepo root:
#
#     docker build -f frontend/Dockerfile -t b2b/frontend .
#
# docker-compose.yml uses `context: .` + `dockerfile: frontend/Dockerfile`.
# Production hosting is Vercel (see deploy/vercel.json); this image is for local
# Compose / Kubernetes parity.
#
# Uses Next.js `output: 'standalone'` (see next.config.mjs) for a minimal runtime.
# ============================================================================

# ----------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
# All workspace manifests are required for `npm ci` against the root lockfile.
COPY package.json package-lock.json ./
COPY packages/shared-node/package.json packages/shared-node/
COPY services/auth/package.json services/auth/
COPY services/bff/package.json services/bff/
COPY services/payment/package.json services/payment/
COPY services/notification/package.json services/notification/
COPY frontend/package.json frontend/
RUN npm ci

# ----------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY frontend frontend
RUN npm run build -w @b2b/frontend

# ----------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
# Standalone server bundle (includes a pruned node_modules), preserving the monorepo layout.
COPY --from=build --chown=nextjs:nodejs /app/frontend/.next/standalone ./
# Static assets are not part of the standalone bundle and must be copied explicitly.
COPY --from=build --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static
USER nextjs
EXPOSE 3000
# server.js lives under frontend/ because tracing root is the monorepo root.
CMD ["node", "frontend/server.js"]
