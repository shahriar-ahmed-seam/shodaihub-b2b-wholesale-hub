import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/client';
import type { SessionUser } from '@/lib/api/types';
import {
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from '@/lib/session';

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

/**
 * Login route handler (Req 1.4, 2.5). Proxies credentials to the BFF, then stores the issued
 * access + refresh tokens in httpOnly cookies so the browser never exposes them to JS. Auth
 * errors from the standard envelope are forwarded verbatim with their status.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let payload: { email?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid request body' } },
      { status: 400 },
    );
  }

  try {
    const result = await apiFetch<LoginResult>('/auth/login', {
      method: 'POST',
      body: { email: payload.email, password: payload.password },
    });

    const res = NextResponse.json({ user: result.user });
    res.cookies.set(SESSION_COOKIE, result.accessToken, sessionCookieOptions(SESSION_MAX_AGE_SECONDS));
    res.cookies.set(REFRESH_COOKIE, result.refreshToken, sessionCookieOptions(REFRESH_MAX_AGE_SECONDS));
    return res;
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message, details: err.details } },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Authentication service is unavailable' } },
      { status: 502 },
    );
  }
}
