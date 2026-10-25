import { NextResponse } from 'next/server';
export function GET() {
  return NextResponse.json({ error: 'Public account setup is disabled.' }, { status: 403 });
}
