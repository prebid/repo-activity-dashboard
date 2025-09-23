import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';

export async function GET() {
  try {
    const session = await auth();

    return NextResponse.json({
      status: 'success',
      message: 'Auth is working',
      hasSession: !!session,
      sessionData: session ? {
        user: session.user?.email,
        role: session.user?.role,
      } : null,
      env: {
        NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'Set' : 'Missing',
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'Set' : 'Missing',
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}