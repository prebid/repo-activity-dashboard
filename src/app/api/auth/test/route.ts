import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export function GET() { return NextResponse.json({ error: 'Use account administration' }, { status: 410, headers: { 'Cache-Control': 'private, no-store' } }); }
