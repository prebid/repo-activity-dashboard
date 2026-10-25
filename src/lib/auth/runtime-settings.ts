import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateRuntimeSettings, type RuntimeSettings } from '@/models/runtime-settings';
export function getRuntimeSettings(): RuntimeSettings {
  let stored: Partial<RuntimeSettings> = {};
  for (const path of ['.dashboard-runtime.json', '.next/server/dashboard-runtime.json']) {
    try {
      const input: unknown = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
      stored = validateRuntimeSettings(input);
      break;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
        throw new Error('Invalid server runtime configuration.');
    }
  }
  const environment = process.env;
  const managed = stored.managed || Boolean(environment.AWS_APP_ID);
  const region =
    environment.DYNAMODB_REGION || stored.region || environment.AWS_REGION || environment.S3_REGION;
  if (managed && !region)
    throw new Error('Managed authentication requires an explicit account-store region.');
  return validateRuntimeSettings({
    version: 1,
    managed,
    region: region || 'us-east-2',
    usersTable: environment.DYNAMODB_USERS_TABLE || stored.usersTable,
    whitelistTable: environment.DYNAMODB_WHITELIST_TABLE || stored.whitelistTable,
    authUrl: environment.AUTH_URL || environment.NEXTAUTH_URL || stored.authUrl,
    secretArn: environment.DASHBOARD_AUTH_SECRET_ARN || stored.secretArn,
  });
}
