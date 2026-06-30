# syntax=docker/dockerfile:1
# ============================================================================
# Auth Service — multi-stage production image (Node.js 20 + TypeScript).
#
# IMPORTANT: build with the REPOSITORY ROOT as the context, because this service
# depends on the `@b2b/shared-node` workspace package:
#
#     docker build -f services/auth/Dockerfile -t b2b/auth .
#
# docker-compose.yml is configured with `context: .` + `dockerfile: services/auth/Dockerfile`.
#
# Stages:
#   deps     — install ALL workspace deps from the root lockfile (npm ci).
#   build    — compile @b2b/shared-node then @b2b/auth to dist/.
#   proddeps — install production-only deps (creates the shared-node symlink).
#   runtime  — slim image running the compiled JS as a non-root user.
# ============================================================================

# ----------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
# argon2 is a native module; alpine (musl) needs a toolchain to build it.
RUN apk add --no-cache python3 make g++
# Copy only manifests first for better layer caching.
COPY package.json package-lock.json ./
COPY packages/shared-node/package.json packages/shared-node/
COPY services/auth/package.json services/auth/
RUN npm ci

# ----------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared-node/node_modules ./packages/shared-node/node_modules
COPY package.json package-lock.json ./
COPY packages/shared-node packages/shared-node
COPY services/auth services/auth
# Build the shared library first, then the service.
RUN npm run build -w @b2b/shared-node \
 && npm run build -w @b2b/auth

# ----------------------------------------------------------------------------
FROM node:20-alpine AS proddeps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY packages/shared-node/package.json packages/shared-node/
COPY services/auth/package.json services/auth/
# Production deps only; npm still wires the @b2b/shared-node workspace symlink.
RUN npm ci --omit=dev

# ----------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    AUTH_PORT=3001
# Production node_modules (includes the @b2b/shared-node -> packages/shared-node symlink).
COPY --from=proddeps /app/node_modules ./node_modules
# Compiled shared library + its manifest (symlink target).
COPY --from=build /app/packages/shared-node/dist ./packages/shared-node/dist
COPY packages/shared-node/package.json ./packages/shared-node/package.json
# Compiled service.
COPY --from=build /app/services/auth/dist ./services/auth/dist
COPY services/auth/package.json ./services/auth/package.json
USER node
EXPOSE 3001
CMD ["node", "services/auth/dist/index.js"]
