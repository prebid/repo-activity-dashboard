import { isPreviewBuild } from '@/lib/presentation/preview';
import { NextResponse } from 'next/server';
import { getDocClient } from '@/lib/aws/clients';
import { ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/passwords';
import { randomUUID } from 'node:crypto';
import { readRequestBody } from '@/lib/auth/request-body';
import { credentialSchema, whitelistRecordSchema } from '@/models/accounts';
import { accountTable } from '@/lib/auth/tables';

// POST /api/auth/setup - One-time admin setup
export async function POST(req: Request) {
  if (isPreviewBuild)
    return NextResponse.json(
      { error: 'Account changes are disabled in preview.' },
      { status: 403 },
    );
  try {
    const body = await readRequestBody(req, credentialSchema);
    if (!body.ok) return body.response;
    const { email, password } = body.data;
    const USERS_TABLE = accountTable('users');
    const WHITELIST_TABLE = accountTable('whitelist');

    // Check if any users exist (this should only work when no users exist)
    const existingUsers = await getDocClient().send(
      new ScanCommand({
        TableName: USERS_TABLE,
        Limit: 1,
      }),
    );

    if (existingUsers.Items && existingUsers.Items.length > 0) {
      return NextResponse.json({ error: 'Setup has already been completed' }, { status: 403 });
    }

    // Check if email is in whitelist and is admin
    const whitelistEntry = await getDocClient().send(
      new GetCommand({
        TableName: WHITELIST_TABLE,
        Key: { email: email.toLowerCase() },
      }),
    );

    const entry = whitelistEntry.Item ? whitelistRecordSchema.parse(whitelistEntry.Item) : null;
    if (!entry?.isActive) {
      return NextResponse.json({ error: 'Email is not in the whitelist' }, { status: 403 });
    }

    if (entry.role !== 'admin') {
      return NextResponse.json(
        { error: 'Email must have admin role in whitelist' },
        { status: 403 },
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.errors.join('. ') }, { status: 400 });
    }

    // Create the first admin user
    const hashedPassword = await hashPassword(password);
    const userId = randomUUID();

    await getDocClient().send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          id: userId,
          email: email.toLowerCase(),
          password: hashedPassword,
          name: email.split('@')[0],
          role: 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'self-setup',
          mustChangePassword: false, // No need to change since they just set it
        },
      }),
    );

    return NextResponse.json({
      message: 'Admin account created successfully',
      email: email.toLowerCase(),
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: 'Setup failed. Please try again.' }, { status: 500 });
  }
}
