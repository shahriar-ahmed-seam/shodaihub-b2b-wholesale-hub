import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/client';
import type { Role, SessionUser } from '@/lib/api/types';

/**
 * Registration route handler (Req 1.1). Forwards the new-account request (including the selected
 * role) to the BFF and relays validation/duplicate errors from the standard envelope. No session
 * is established here — new accounts are PENDING_VERIFICATION until approved.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let payload: {
    email?: string;
    password?: string;
    businessName?: string;
    role?: Role;
    preferredLanguage?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid request body' } },
      { status: 400 },
    );
  }

  try {
    const result = await apiFetch<{ user: SessionUser }>('/auth/register', {
      method: 'POST',
      body: {
        email: payload.email,
        password: payload.password,
        businessName: payload.businessName,
        role: payload.role,
        preferredLanguage: payload.preferredLanguage,
      },
    });
    return NextResponse.json(result, { status: 201 });
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
