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

  // Check environment variables
  diagnostics.checks.envVars = {
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    S3_ACCESS_KEY_ID: !!process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: !!process.env.S3_SECRET_ACCESS_KEY,
    S3_REGION: !!process.env.S3_REGION,
    S3_BUCKET_NAME: !!process.env.S3_BUCKET_NAME,
    DYNAMODB_REGION: !!process.env.DYNAMODB_REGION,
    DYNAMODB_TABLE_NAME: !!process.env.DYNAMODB_TABLE_NAME,
    DYNAMODB_ACCOUNTS_TABLE: !!process.env.DYNAMODB_ACCOUNTS_TABLE,
    DYNAMODB_SESSIONS_TABLE: !!process.env.DYNAMODB_SESSIONS_TABLE,
    DYNAMODB_VERIFICATION_TOKENS_TABLE: !!process.env.DYNAMODB_VERIFICATION_TOKENS_TABLE,
  };

  // Check critical files
  const mappingPath = path.join(process.cwd(), 'store/sheets/github-mapping.json');
  const timelinePath = path.join(process.cwd(), 'contributor-repo-timeline.json');

  diagnostics.checks.criticalFiles = {
    'github-mapping.json': fs.existsSync(mappingPath),
    'contributor-repo-timeline.json': fs.existsSync(timelinePath),
  };

  // Check if files have content
  if (fs.existsSync(mappingPath)) {
    const stats = fs.statSync(mappingPath);
    diagnostics.checks.criticalFiles['github-mapping.json-size'] = stats.size;
  }

  if (fs.existsSync(timelinePath)) {
    const stats = fs.statSync(timelinePath);
    diagnostics.checks.criticalFiles['contributor-repo-timeline.json-size'] = stats.size;
  }

  // Test AWS connectivity (without actually connecting)
  diagnostics.checks.awsConfig = {
    hasCredentials: !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY),
    hasRegion: !!process.env.S3_REGION,
  };

  // Overall status
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