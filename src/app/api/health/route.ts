import { NextResponse } from 'next/server';
export function GET() {
  return NextResponse.json({ status: 'ok', reporting: 'sample-data' });
}
