/**
 * Core API client (design: Frontend Design → Data layer). Every request targets the BFF public
 * API (`NEXT_PUBLIC_BFF_URL/api`) and, when a session token is supplied, attaches it as a bearer.
 * Errors are parsed from the standard error envelope into a typed {@link ApiError} so the UI can
 * surface `error.message` / field-level `details` uniformly (design: Error Handling).
 *
 * This module is intentionally framework-neutral (no next/headers import) so it can be reused
 * from server components, route handlers, and client components, and mocked wholesale in tests.
 */

import { API_BASE } from '../env';
import { mocksEnabled } from '../mock/flag';
import { mockResolve } from '../mock/engine';
import type { ErrorEnvelope } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorEnvelope['error']['details'];
  readonly correlationId?: string;

  constructor(status: number, envelope: ErrorEnvelope['error']) {
    super(envelope.message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = envelope.code;
    this.details = envelope.details;
    this.correlationId = envelope.correlationId;
  }
}

export interface ApiRequestOptions {
  method?: string;
  /** JSON-serialisable request body. */
  body?: unknown;
  /** Bearer token for authenticated calls. */
  token?: string;
  /** Extra query parameters appended to the path. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Next.js fetch cache control; defaults to no-store for live data. */
  cache?: RequestCache;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

function buildUrl(path: string, query?: ApiRequestOptions['query']): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${API_BASE}${normalized}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseError(res: Response): Promise<ApiError> {
  let envelope: ErrorEnvelope['error'] = { code: 'UNKNOWN', message: res.statusText };
  try {
    const json = (await res.json()) as Partial<ErrorEnvelope>;
    if (json?.error) envelope = json.error;
  } catch {
    // Non-JSON error body — keep the status-text fallback.
  }
  return new ApiError(res.status, envelope);
}

/**
 * Perform a typed API request against the BFF. Resolves with the parsed JSON body (or `undefined`
 * for empty 204 responses) and throws {@link ApiError} for non-2xx responses.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, query, cache = 'no-store', signal, headers } = options;

  // Standalone mock mode (default ON): resolve against the in-memory dataset, preserving the
  // ApiError throwing semantics so the UI behaves identically to a live BFF.
  if (mocksEnabled()) {
    return mockResolve<T>(path, { method, body, token, query });
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    cache,
    signal,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
