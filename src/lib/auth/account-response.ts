import { NextResponse } from 'next/server';
import { AccountError } from './account-errors';
import type { AuthStateError } from './auth-errors';
export function accountJson<T>(body: T, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('cache-control', 'private, no-store');
  return NextResponse.json(body, { ...init, headers });
}
export function authFailureResponse(kind: AuthStateError['kind'], init?: ResponseInit) {
  return accountJson(
    {
      error:
        kind === 'unavailable'
          ? 'Authentication is temporarily unavailable. Please try again.'
          : 'Authentication requires operator attention.',
    },
    { ...init, status: kind === 'unavailable' ? 503 : 500 },
  );
}
export function accountErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AccountError)
    return accountJson(
      { error: error.message },
      {
        status:
          error.code === 'expired'
            ? 401
            : error.code === 'not-found'
              ? 404
              : error.code === 'integrity'
                ? 500
                : 409,
      },
    );
  return accountJson({ error: fallback }, { status: 500 });
}
