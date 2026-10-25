import { NextResponse } from 'next/server';
export function POST() {
  return NextResponse.json({ error: 'Account provisioning is operator-only.' }, { status: 403 });
}
