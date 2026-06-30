# syntax=docker/dockerfile:1
# ============================================================================
# Notification Service — multi-stage production image (Node.js 20 + TypeScript).
#
# IMPORTANT: build with the REPOSITORY ROOT as the context (depends on the
# `@b2b/shared-node` workspace package):
#
#     docker build -f services/notification/Dockerfile -t b2b/notification .
#
# docker-compose.yml uses `context: .` + `dockerfile: services/notification/Dockerfile`.
# ============================================================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared-node/package.json packages/shared-node/
COPY services/notification/package.json services/notification/
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared-node/node_modules ./packages/shared-node/node_modules
COPY package.json package-lock.json ./
COPY packages/shared-node packages/shared-node
COPY services/notification services/notification
RUN npm run build -w @b2b/shared-node \
 && npm run build -w @b2b/notification

FROM node:20-alpine AS proddeps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared-node/package.json packages/shared-node/
COPY services/notification/package.json services/notification/
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NOTIFICATION_PORT=3002
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared-node/dist ./packages/shared-node/dist
COPY packages/shared-node/package.json ./packages/shared-node/package.json
COPY --from=build /app/services/notification/dist ./services/notification/dist
COPY services/notification/package.json ./services/notification/package.json
USER node
EXPOSE 3002
CMD ["node", "services/notification/dist/index.js"]
