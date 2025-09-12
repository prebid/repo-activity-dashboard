import { NextRequest, NextResponse } from 'next/server';
import { readdirSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
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
    });
  } catch (error) {
    console.error('Error reading repositories:', error);
    return NextResponse.json(
      { error: 'Failed to load repositories' },
      { status: 500 }
    );
  }
}