/**
 * Thin fetch-based reverse proxy (design: Components → API Gateway/BFF).
 *
 * Forwards an already-authorized request to the resolved upstream service using the Node 20 global
 * `fetch`. The gateway is deliberately a *thin* pass-through: it forwards the method, path, query
 * string, a filtered set of headers, and the raw request body verbatim, then streams the upstream
 * status, headers, and body back to the client.
 *
 * Identity is forwarded as internal headers the upstream services trust (`X-User-Id`,
 * `X-User-Role`) plus the original bearer token, and the correlation id is propagated on every hop
 * (`X-Correlation-Id`) for end-to-end tracing (Req 2.1, 2.2, 20.2).
 *
 * Upstream connection failures map to 502; timeouts map to 504 (design: HTTP Status Conventions).
 */

import { CORRELATION_ID_HEADER, type Logger, makeError } from '@b2b/shared-node';
import type { Request, Response } from 'express';
import type { CapturedBodyFields } from '../middleware/bodyCapture.js';
import type { UpstreamService } from '../domain/permissions.js';
import type { Role } from '../domain/roles.js';

/** Identity resolved by the auth gate and forwarded to upstream services. */
export interface ForwardIdentity {
  userId: string;
  role: Role;
  /** The original bearer token, forwarded so a downstream service may re-verify if it chooses. */
  bearer: string;
}

/** Hop-by-hop / host headers that must not be forwarded as-is to the upstream. */
const STRIP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  // The correlation id is (re)set explicitly below from the resolved value to avoid duplicate
  // headers when the client supplies its own (header names are case-insensitive).
  'x-correlation-id',
  // Never trust client-supplied identity headers; they are set only from the verified token.
  'x-user-id',
  'x-user-role',
]);

const STRIP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
]);

export interface ProxyDeps {
  serviceUrls: Record<UpstreamService, string>;
  timeoutMs: number;
  logger: Logger;
  /** Injectable fetch for testing; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export interface ProxyTarget {
  service: UpstreamService;
  /** Upstream path (without `/api` prefix), e.g. `/auth/login`. */
  path: string;
}

export type ProxyHandler = (
  req: Request,
  res: Response,
  target: ProxyTarget,
  identity: ForwardIdentity | null,
) => Promise<void>;

function buildForwardHeaders(
  req: Request,
  correlationId: string,
  identity: ForwardIdentity | null,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (STRIP_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  // Always propagate the correlation id (Req 20.2).
  headers[CORRELATION_ID_HEADER] = correlationId;

  if (identity) {
    // Forward the verified identity as internal headers (Req 2.1, 2.2) and the original token.
    headers['X-User-Id'] = identity.userId;
    headers['X-User-Role'] = identity.role;
    headers['authorization'] = `Bearer ${identity.bearer}`;
  } else {
    // Public route: strip any client-supplied identity headers to prevent spoofing.
    delete headers['x-user-id'];
    delete headers['x-user-role'];
  }

  return headers;
}

export function createProxy(deps: ProxyDeps): ProxyHandler {
  const doFetch = deps.fetchImpl ?? fetch;

  return async function proxy(req, res, target, identity): Promise<void> {
    const correlationId =
      (req as Request & { correlationId?: string }).correlationId ??
      (res.getHeader(CORRELATION_ID_HEADER) as string | undefined) ??
      '';

    const base = deps.serviceUrls[target.service].replace(/\/+$/, '');
    const query = req.originalUrl.includes('?') ? `?${req.originalUrl.split('?')[1]!}` : '';
    const url = `${base}${target.path}${query}`;

    const headers = buildForwardHeaders(req, correlationId, identity);
    const rawBody = (req as Request & CapturedBodyFields).rawBody;
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && rawBody && rawBody.length > 0;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs);

    try {
      const upstream = await doFetch(url, {
        method: req.method,
        headers,
        body: hasBody ? rawBody : undefined,
        signal: controller.signal,
      });

      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) return;
        // Don't clobber the correlation id the gateway already set on the response.
        if (key.toLowerCase() === CORRELATION_ID_HEADER.toLowerCase()) return;
        res.setHeader(key, value);
      });

      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      const status = aborted ? 504 : 502;
      const code = aborted ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE';
      const message = aborted
        ? `Upstream service '${target.service}' timed out`
        : `Upstream service '${target.service}' is unavailable`;
      deps.logger.child(correlationId).error('Upstream proxy error', {
        service: target.service,
        path: target.path,
        error: String(err),
      });
      if (!res.headersSent) {
        res.status(status).json(makeError(code, message, correlationId));
      }
    } finally {
      clearTimeout(timer);
    }
  };
}
