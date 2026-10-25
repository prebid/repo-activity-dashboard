import { isPreviewBuild } from '@/lib/presentation/preview';
import { NextResponse } from 'next/server';
import { getDocClient } from '@/lib/aws/clients';
import { accountTable } from '@/lib/auth/tables';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

// GET /api/auth/setup/check - Check if any users exist
export async function GET() {
  if (isPreviewBuild)
    return NextResponse.json(
      { error: 'Account changes are disabled in preview.' },
      { status: 403 },
    );
  try {
    const USERS_TABLE = accountTable('users');

    const result = await getDocClient().send(
      new ScanCommand({
        TableName: USERS_TABLE,
        Limit: 1, // We just need to know if ANY user exists
      }),
    );

    return NextResponse.json({
      hasUsers: (result.Items?.length ?? 0) > 0,
    });
  } catch {
    // On error, assume users exist (safer)
    return NextResponse.json({ hasUsers: true });
  }
}
