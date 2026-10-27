import { NextRequest, NextResponse } from 'next/server';
import { readdirSync } from 'fs';
import { join } from 'path';
import { requireDataAccess, privateHeaders } from '@/lib/auth/site-access';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const denied = await requireDataAccess();
    if (denied) return denied;
    // Path to your store directory
    const storeDir = join(process.cwd(), 'store', 'repos');
    
    // Read all repository directories
    const repoDirs = readdirSync(storeDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
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