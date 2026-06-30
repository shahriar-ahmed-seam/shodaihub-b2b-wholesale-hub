# syntax=docker/dockerfile:1
# ============================================================================
# Payment Gateway — multi-stage production image (Node.js 20 + TypeScript).
#
# IMPORTANT: build with the REPOSITORY ROOT as the context (depends on the
# `@b2b/shared-node` workspace package):
#
#     docker build -f services/payment/Dockerfile -t b2b/payment .
#
# docker-compose.yml uses `context: .` + `dockerfile: services/payment/Dockerfile`.
# ============================================================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared-node/package.json packages/shared-node/
COPY services/payment/package.json services/payment/
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared-node/node_modules ./packages/shared-node/node_modules
COPY package.json package-lock.json ./
COPY packages/shared-node packages/shared-node
COPY services/payment services/payment
RUN npm run build -w @b2b/shared-node \
 && npm run build -w @b2b/payment

FROM node:20-alpine AS proddeps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared-node/package.json packages/shared-node/
COPY services/payment/package.json services/payment/
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PAYMENT_PORT=3003
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared-node/dist ./packages/shared-node/dist
COPY packages/shared-node/package.json ./packages/shared-node/package.json
COPY --from=build /app/services/payment/dist ./services/payment/dist
COPY services/payment/package.json ./services/payment/package.json
USER node
EXPOSE 3003
CMD ["node", "services/payment/dist/index.js"]
