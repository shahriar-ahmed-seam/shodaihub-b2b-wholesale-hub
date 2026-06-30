import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_BASE } from '@/lib/env';
import { SESSION_COOKIE } from '@/lib/session';

/**
 * Authenticated BFF proxy for client components (design: Frontend Design → Data layer / State).
 *
 * Client code can't read the httpOnly session cookie, so interactive mutations (cart qty/remove,
 * reservation renew, fulfilment actions, payment initiate, etc.) are routed through this handler:
 * it injects the session bearer server-side and forwards method, body, and query to the BFF,
 * relaying the upstream status and standard error envelope back to the client unchanged.
 */

const FORWARD_PREFIX = '/api/bff';

async function forward(request: Request): Promise<NextResponse> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const incoming = new URL(request.url);
  const upstreamPath = incoming.pathname.slice(FORWARD_PREFIX.length) || '/';
  const target = `${API_BASE}${upstreamPath}${incoming.search}`;

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'DELETE';
  let body: string | undefined;
  if (hasBody) {
    body = await request.text();
  }

  try {
    const upstream = await fetch(target, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') ?? 'application/json';
    return new NextResponse(text || null, {
      status: upstream.status,
      headers: { 'content-type': contentType },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Service is temporarily unavailable' } },
      { status: 502 },
    );
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const DELETE = forward;
export const PATCH = forward;
