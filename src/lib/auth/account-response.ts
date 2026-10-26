import { NextResponse } from 'next/server';
import { AccountError } from './account-errors';
export function accountErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AccountError)
    return NextResponse.json(
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
  return NextResponse.json({ error: fallback }, { status: 500 });
}
