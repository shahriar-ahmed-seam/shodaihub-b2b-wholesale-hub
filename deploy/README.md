# Deployment Manifests

Hosted-environment deployment artifacts. See the top-level `DEPLOYMENT.md` for
the full guide (local Compose, Render + Vercel, and Kubernetes).

- **`k8s/`** — Kubernetes manifests, applied in lexical order with
  `kubectl apply -f deploy/k8s/`:
  - `00-namespace.yaml`, `01-configmap.yaml`, `02-secret.yaml` (placeholders).
  - `10-auth`, `11-bff`, `20-inventory`, `21-search`, `30-payment`,
    `31-notification` — each a `Deployment` + ClusterIP `Service` +
    `HorizontalPodAutoscaler`, with liveness/readiness probes on the service's
    health endpoint.
  - `40-ingress.yaml` — exposes **only the BFF** over TLS.
  - `50-datastores.yaml` — `StatefulSet`s for Postgres ×4 / Redis / ElasticSearch
    (dev/self-hosted; prefer managed datastores in production).
- **`render.yaml`** — Render Blueprint: per-service Docker services (BFF public,
  rest private), managed Postgres + Redis, `b2b-secrets` env group; ES notes.
- **`vercel.json`** + **`vercel.md`** — Vercel project config and docs for the
  Next.js frontend (`NEXT_PUBLIC_BFF_URL`, default locale `en`, build settings).

Local development uses the root `docker-compose.yml` (see the top-level README
and `DEPLOYMENT.md`).
