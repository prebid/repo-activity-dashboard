import { NextResponse } from 'next/server';
import { docClient } from '@/lib/aws/clients';
import { ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/passwords';
import { v4 as uuidv4 } from 'uuid';

// POST /api/auth/setup - One-time admin setup
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE!;
    const WHITELIST_TABLE = process.env.DYNAMODB_WHITELIST_TABLE!;

    // Check if any users exist (this should only work when no users exist)
    const existingUsers = await docClient.send(
      new ScanCommand({
        TableName: USERS_TABLE,
        Limit: 1,
      })
    );

    if (existingUsers.Items && existingUsers.Items.length > 0) {
      return NextResponse.json(
        { error: 'Setup has already been completed' },
        { status: 403 }
      );
    }

    // Check if email is in whitelist and is admin
    const whitelistEntry = await docClient.send(
      new GetCommand({
        TableName: WHITELIST_TABLE,
        Key: { email: email.toLowerCase() },
      })
    );

    if (!whitelistEntry.Item || !whitelistEntry.Item.isActive) {
      return NextResponse.json(
        { error: 'Email is not in the whitelist' },
        { status: 403 }
      );
    }

    if (whitelistEntry.Item.role !== 'admin') {
      return NextResponse.json(
        { error: 'Email must have admin role in whitelist' },
        { status: 403 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors.join('. ') },
        { status: 400 }
      );
    }

    // Create the first admin user
    const hashedPassword = await hashPassword(password);
    const userId = uuidv4();

    await docClient.send(
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
      })
    );

    return NextResponse.json({
      message: 'Admin account created successfully',
      email: email.toLowerCase(),
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Setup failed. Please try again.' },
      { status: 500 }
    );
  }
}