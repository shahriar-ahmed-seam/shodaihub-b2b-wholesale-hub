import 'server-only';
import { cookies } from 'next/headers';
import { apiFetch, ApiError, type ApiRequestOptions } from './client';
import { SESSION_COOKIE } from '../session';
import type { SessionUser } from './types';

/**
 * Server-side API helpers. These read the httpOnly session cookie to attach the caller's bearer
 * token automatically, so server components and server actions never handle the raw token in
 * client code.
 */

export function getSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}

/** Authenticated server-side fetch: injects the session bearer from the cookie. */
export async function apiFetchAuthed<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const token = getSessionToken();
  return apiFetch<T>(path, { ...options, token: options.token ?? token });
}

/**
 * Resolve the current session user via `/auth/me`, or `null` when unauthenticated / the BFF is
 * unreachable. Never throws so layouts can render for anonymous visitors during `next build`.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getSessionToken();
  if (!token) return null;
  try {
    const res = await apiFetch<{ user: SessionUser }>('/auth/me', { token });
    return res.user;
  } catch (err) {
    if (err instanceof ApiError) return null;
    return null;
  }
}
