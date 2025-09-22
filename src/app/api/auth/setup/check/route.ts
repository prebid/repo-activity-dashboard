import { NextResponse } from 'next/server';
import { docClient } from '@/lib/aws/clients';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

// GET /api/auth/setup/check - Check if any users exist
export async function GET() {
  try {
    const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE!;

    const result = await docClient.send(
      new ScanCommand({
        TableName: USERS_TABLE,
        Limit: 1, // We just need to know if ANY user exists
      })
    );

    return NextResponse.json({
      hasUsers: (result.Items?.length ?? 0) > 0
    });
  } catch (error) {
    // On error, assume users exist (safer)
    return NextResponse.json({ hasUsers: true });
  }
}