# syntax=docker/dockerfile:1
# ============================================================================
# API Gateway / BFF — multi-stage production image (Node.js 20 + TypeScript).
#
# IMPORTANT: build with the REPOSITORY ROOT as the context (depends on the
# `@b2b/shared-node` workspace package):
#
#     docker build -f services/bff/Dockerfile -t b2b/bff .
#
# docker-compose.yml uses `context: .` + `dockerfile: services/bff/Dockerfile`.
# ============================================================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared-node/package.json packages/shared-node/
COPY services/bff/package.json services/bff/
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared-node/node_modules ./packages/shared-node/node_modules
COPY package.json package-lock.json ./
COPY packages/shared-node packages/shared-node
COPY services/bff services/bff
RUN npm run build -w @b2b/shared-node \
 && npm run build -w @b2b/bff

FROM node:20-alpine AS proddeps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared-node/package.json packages/shared-node/
COPY services/bff/package.json services/bff/
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    BFF_PORT=8080
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared-node/dist ./packages/shared-node/dist
COPY packages/shared-node/package.json ./packages/shared-node/package.json
COPY --from=build /app/services/bff/dist ./services/bff/dist
COPY services/bff/package.json ./services/bff/package.json
USER node
EXPOSE 8080
CMD ["node", "services/bff/dist/index.js"]
