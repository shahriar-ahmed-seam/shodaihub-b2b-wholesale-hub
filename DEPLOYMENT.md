# Deployment Guide — B2B-Wholesale-Hub

This document covers running the full stack three ways: **locally with Docker
Compose**, **hosted on Render (backend) + Vercel (frontend)**, and **on
Kubernetes**. It reflects the design's Deployment Topology and Milestone 11.

## Services and ports

| Service        | Stack                     | Port | Health endpoint        | Public? |
|----------------|---------------------------|------|------------------------|---------|
| bff            | Node 20 / Express         | 8080 | `/health`              | **Yes** (edge) |
| auth           | Node 20 / Express         | 3001 | `/auth/health`         | No |
| inventory      | Java 21 / Spring Boot 3   | 8081 | `/inventory/health`    | No |
| search         | Python 3.12 / FastAPI     | 8000 | `/search/health`       | No |
| payment        | Node 20 / Express         | 3003 | `/payments/health`     | No |
| notification   | Node 20 / Express         | 3002 | `/health`              | No |
| frontend       | Next.js 14                | 3000 | n/a (Vercel-hosted)    | **Yes** (edge) |

Datastores: Postgres ×4 (auth, inventory, notifications, payment), Redis,
ElasticSearch 8. The **BFF is the only public backend**; everything else is
internal and reached through it.

## Container images

Each service has a production multi-stage `Dockerfile`:

- **Node services** (`auth`, `bff`, `payment`, `notification`) build from the
  **repository root** context so the `@b2b/shared-node` workspace package is
  compiled and linked into the image. They run as the non-root `node` user.
  Build example: `docker build -f services/auth/Dockerfile -t b2b/auth .`
- **inventory** builds from `services/inventory` (Gradle `bootJar` → JRE 21
  runtime, non-root `appuser`).
- **search** builds from `services/search` (venv with runtime deps → slim
  Python runtime, uvicorn, non-root `appuser`).
- **frontend** builds from the repository root using Next.js `standalone`
  output. The standalone server lives at `frontend/server.js` inside the image
  (the monorepo trace root is set via `experimental.outputFileTracingRoot`).

---

## 1. Local — Docker Compose

Prerequisites: Docker Desktop (Compose v2).

```bash
# 1. Configure environment
cp .env.example .env
#    Set JWT_PRIVATE_KEY / JWT_PUBLIC_KEY (RS256 PEM) and any provider secrets.

# 2. Bring up datastores first (they have healthchecks the apps depend on)
docker compose up -d postgres-auth postgres-inventory postgres-notif postgres-payment redis elasticsearch

# 3. Build and start the application services
docker compose build
docker compose up -d

# 4. Tail logs / check status
docker compose ps
docker compose logs -f bff
```

The frontend is published at `http://localhost:3000`, the BFF at
`http://localhost:8080`. `NEXT_PUBLIC_BFF_URL` defaults to
`http://localhost:8080` for local parity (production uses Vercel + the hosted
BFF). Validate the compose file any time with `docker compose config`.

Tear down: `docker compose down` (add `-v` to drop the named volumes).

---

## 2. Hosted — Render (backend) + Vercel (frontend)

### Backend on Render

`deploy/render.yaml` is a Render Blueprint that provisions:

- One **Docker service per microservice**, independently scalable. Only the
  **BFF is a public `web` service** (TLS at Render's edge); the rest are private
  `pserv` services on Render's private network.
- **Managed PostgreSQL** per service and a **managed Key Value (Redis)** instance.
- A **`b2b-secrets` environment group** holding the JWT keypair, payment provider
  secrets, and `ELASTICSEARCH_URL` (set as secret values in the dashboard).

Steps:

1. In Render, create a **Blueprint** pointed at this repo (`deploy/render.yaml`).
2. Fill the `b2b-secrets` group: `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, the bKash /
   Nagad / SSLCommerz secrets, and `ELASTICSEARCH_URL`.
3. Provide ElasticSearch separately (Elastic Cloud / Bonsai / managed OpenSearch,
   or a private ES Docker service) — Render has no first-party ES. See the notes
   at the bottom of `deploy/render.yaml`.
4. Apply. DB connection strings and inter-service URLs are auto-wired by the
   blueprint via `fromDatabase` / `fromService`.

### Frontend on Vercel

See `deploy/vercel.md` for the full walkthrough. Summary:

- Keep the Vercel **Root Directory at the repo root** (npm workspaces); build with
  `npm run build -w @b2b/frontend`, output `frontend/.next` (encoded in
  `deploy/vercel.json`).
- Set **`NEXT_PUBLIC_BFF_URL`** to the public BFF origin (the Render BFF URL).
- Default locale is **`en`** (`/en`, `/bn` segments via `next-intl`), configured
  in code — no env var needed.
- Vercel terminates TLS and serves over its CDN.

---

## 3. Kubernetes

Manifests live in `deploy/k8s/` and apply in lexical order:

```bash
# Edit deploy/k8s/02-secret.yaml first (or create the Secret out of band).
kubectl apply -f deploy/k8s/
```

What you get:

- **Deployment + HorizontalPodAutoscaler per service** (CPU-target autoscaling),
  with **liveness/readiness probes** wired to each service's health endpoint.
  Inventory additionally uses a `startupProbe` for JVM warmup.
- **ClusterIP Services** for all internal services.
- An **Ingress exposing only the BFF over TLS** (`40-ingress.yaml`, nginx +
  cert-manager assumptions; adjust host and issuer to your cluster).
- A **ConfigMap** (`b2b-config`) for non-secret config and a **Secret**
  (`b2b-secrets`, placeholders) for DB URLs, the JWT keypair, and provider secrets.
- **StatefulSets** for Postgres ×4, Redis, and ElasticSearch so the stack runs on
  a bare cluster. **For production, prefer managed datastores** — point the
  ConfigMap/Secret URLs at them and delete `50-datastores.yaml` (the app
  Deployments need no change since they read endpoints from config).

Before applying, replace the image references (`b2b/<svc>:latest`) with your
pushed registry images, e.g. `ghcr.io/<org>/b2b-wholesale-hub-<svc>:<sha>`. The
CI deploy workflow pushes exactly these images.

---

## CI/CD (GitHub Actions)

- **`.github/workflows/ci.yml`** — on PRs and pushes to `main`: a per-service job
  matrix builds and tests each service. Node workspaces run vitest (unit +
  fast-check properties); inventory runs Gradle with jqwik + Testcontainers
  (Postgres/Redis); search runs pytest with Hypothesis + an ElasticSearch
  Testcontainer; the frontend lints, tests, and builds.
- **`.github/workflows/deploy.yml`** — on merge to `main`: a matrix builds and
  pushes every image to GHCR (tagged with the commit SHA and `latest`), then
  triggers Render and Vercel deploy hooks (stored as repository secrets).

Required deploy secrets: `RENDER_DEPLOY_HOOK_{BFF,AUTH,INVENTORY,SEARCH,PAYMENT,NOTIFICATION}`
and `VERCEL_DEPLOY_HOOK_FRONTEND`. Image push uses the built-in `GITHUB_TOKEN`.

---

## Configuration reference

All config is environment-driven. Copy `.env.example` → `.env` for local use; on
Render/Vercel/Kubernetes the same keys are injected as platform env vars /
secrets. Sensitive values (DB credentials, `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`,
payment provider secrets) must never be committed — they live in Render
environment groups, the Kubernetes `Secret`, or Vercel project settings.
