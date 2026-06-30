'use client';

import { ApiError } from './client';
import { mocksEnabled } from '../mock/flag';
import { mockResolve } from '../mock/engine';
import type { ErrorEnvelope } from './types';

/**
 * Browser-side API helper. Routes through the authenticated Next proxy (`/api/bff/...`) so the
 * httpOnly session bearer is attached server-side. Parses the standard error envelope into an
 * {@link ApiError}, consistent with the server-side `apiFetch`.
 */
export async function bff<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const { method = 'GET', body, query } = options;

  // Standalone mock mode (default ON): no token on the client, so the engine resolves cart/orders
  // calls as the retailer by default. Token-scoped (supplier/admin) reads happen server-side.
  if (mocksEnabled()) {
    return mockResolve<T>(path, { method, body, query });
  }

  const search = query
    ? `?${new URLSearchParams(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()}`
    : '';

  const res = await fetch(`/api/bff${path.startsWith('/') ? path : `/${path}`}${search}`, {
    method,
    headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let envelope: ErrorEnvelope['error'] = { code: 'UNKNOWN', message: res.statusText };
    try {
      const json = (await res.json()) as Partial<ErrorEnvelope>;
      if (json?.error) envelope = json.error;
    } catch {
      /* keep fallback */
    }
    throw new ApiError(res.status, envelope);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
