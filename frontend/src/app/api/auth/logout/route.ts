import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiFetch } from '@/lib/api/client';
import { REFRESH_COOKIE, SESSION_COOKIE } from '@/lib/session';

/**
 * Logout route handler (Req 1.9, 16.2 support). Best-effort revokes the refresh token at the BFF,
 * then clears both session cookies regardless of upstream outcome.
 */
export async function POST(): Promise<NextResponse> {
  const jar = cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;

  if (token && refreshToken) {
    try {
      await apiFetch('/auth/logout', { method: 'POST', token, body: { refreshToken } });
    } catch {
      // Revocation is best-effort; cookies are still cleared below.
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}
