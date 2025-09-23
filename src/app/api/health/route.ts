import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const diagnostics: any = {
    status: 'checking',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {}
  };

  diagnostics.checks.envVars = {
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
    AUTH_URL: !!process.env.AUTH_URL,
    S3_ACCESS_KEY_ID: !!process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: !!process.env.S3_SECRET_ACCESS_KEY,
    S3_REGION: !!process.env.S3_REGION,
    S3_BUCKET_NAME: !!process.env.S3_BUCKET_NAME,
    DYNAMODB_USERS_TABLE: !!process.env.DYNAMODB_USERS_TABLE,
    DYNAMODB_ACCOUNTS_TABLE: !!process.env.DYNAMODB_ACCOUNTS_TABLE,
    DYNAMODB_WHITELIST_TABLE: !!process.env.DYNAMODB_WHITELIST_TABLE,
    AWS_REGION: !!process.env.AWS_REGION,
  };

  diagnostics.checks.actualValues = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'not set',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'not set',
    AUTH_URL: process.env.AUTH_URL || 'not set',
    NODE_ENV: process.env.NODE_ENV || 'not set',
    AWS_REGION: process.env.AWS_REGION || 'not set',
    S3_REGION: process.env.S3_REGION || 'not set',
    DYNAMODB_USERS_TABLE: process.env.DYNAMODB_USERS_TABLE || 'not set',
    DYNAMODB_ACCOUNTS_TABLE: process.env.DYNAMODB_ACCOUNTS_TABLE || 'not set',
    DYNAMODB_WHITELIST_TABLE: process.env.DYNAMODB_WHITELIST_TABLE || 'not set',
  };

  const mappingPath = path.join(process.cwd(), 'store/sheets/github-mapping.json');
  const timelinePath = path.join(process.cwd(), 'contributor-repo-timeline.json');

  diagnostics.checks.criticalFiles = {
    'github-mapping.json': fs.existsSync(mappingPath),
    'contributor-repo-timeline.json': fs.existsSync(timelinePath),
  };

  if (fs.existsSync(mappingPath)) {
    const stats = fs.statSync(mappingPath);
    diagnostics.checks.criticalFiles['github-mapping.json-size'] = stats.size;
  }

  if (fs.existsSync(timelinePath)) {
    const stats = fs.statSync(timelinePath);
    diagnostics.checks.criticalFiles['contributor-repo-timeline.json-size'] = stats.size;
  }

  diagnostics.checks.awsConfig = {
    hasCredentials: !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY),
    hasRegion: !!process.env.S3_REGION,
  };

  try {
    const { auth } = await import('@/lib/auth/auth');
    diagnostics.checks.authInit = 'Success - NextAuth initialized';
  } catch (error: any) {
    diagnostics.checks.authInit = `Failed - ${error.message}`;
  }

  // Test DynamoDB access
  diagnostics.checks.dynamoDb = {};
  try {
    const { docClient } = await import('@/lib/aws/clients');
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');

    // Test whitelist table access
    try {
      const result = await docClient.send(
        new ScanCommand({
          TableName: process.env.DYNAMODB_WHITELIST_TABLE || 'repo-dashboard-whitelist',
          Limit: 1,
        })
      );
      diagnostics.checks.dynamoDb.whitelist = {
        accessible: true,
        itemCount: result.Items?.length || 0,
      };
    } catch (error: any) {
      diagnostics.checks.dynamoDb.whitelist = {
        accessible: false,
        error: error.name,
        message: error.message,
        code: error.$metadata?.httpStatusCode,
      };
    }

    // Test users table access
    try {
      const result = await docClient.send(
        new ScanCommand({
          TableName: process.env.DYNAMODB_USERS_TABLE || 'repo-dashboard-users',
          Limit: 1,
        })
      );
      diagnostics.checks.dynamoDb.users = {
        accessible: true,
        itemCount: result.Items?.length || 0,
      };
    } catch (error: any) {
      diagnostics.checks.dynamoDb.users = {
        accessible: false,
        error: error.name,
        message: error.message,
        code: error.$metadata?.httpStatusCode,
      };
    }
  } catch (error: any) {
    diagnostics.checks.dynamoDb = {
      error: 'Failed to initialize DynamoDB client',
      message: error.message,
    };
  }

  const envVarsOk = Object.values(diagnostics.checks.envVars).every(v => v === true);
  const filesOk = diagnostics.checks.criticalFiles['github-mapping.json'] &&
                  diagnostics.checks.criticalFiles['contributor-repo-timeline.json'];

  diagnostics.status = envVarsOk && filesOk ? 'healthy' : 'unhealthy';
  diagnostics.issues = [];

  if (!envVarsOk) {
    const missing = Object.entries(diagnostics.checks.envVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);
    diagnostics.issues.push(`Missing environment variables: ${missing.join(', ')}`);
  }

  if (!filesOk) {
    const missingFiles = Object.entries(diagnostics.checks.criticalFiles)
      .filter(([key, value]) => key.endsWith('.json') && !value)
      .map(([key]) => key);
    diagnostics.issues.push(`Missing files: ${missingFiles.join(', ')}`);
  }

  return NextResponse.json(diagnostics);
}