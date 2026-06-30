/**
 * Session cookie contract (design: Frontend Design → State: "auth/session in an httpOnly cookie").
 *
 * The access + refresh tokens issued by the Auth Service (via the BFF) are stored in httpOnly,
 * SameSite=Lax cookies set by Next.js route handlers — never readable by client JS, mitigating
 * token theft via XSS. Server components read the access token to attach the bearer when calling
 * the BFF on the user's behalf.
 */

export const SESSION_COOKIE = 'b2b_session';
export const REFRESH_COOKIE = 'b2b_refresh';

/** Access-token lifetime is 60 minutes (Req 1.4); refresh is 7 days. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60;
export const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface SessionCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
}

export function sessionCookieOptions(maxAge: number): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}
