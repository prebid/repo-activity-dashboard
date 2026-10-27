import { NextRequest, NextResponse } from 'next/server';
import { reportRepositories } from '@/lib/report-files';
import { requireDataAccess, privateHeaders } from '@/lib/auth/site-access';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const denied = await requireDataAccess();
    if (denied) return denied;
    const repoDirs = reportRepositories();

    // For now, just return the list of repositories
    return NextResponse.json({
      repositories: repoDirs,
      count: repoDirs.length,
    }, { headers: privateHeaders });
  } catch (error) {
    console.error('Error reading repositories:', error);
    return NextResponse.json(
      { error: 'Failed to load repositories' },
      { status: 500 }
    );
  }
}