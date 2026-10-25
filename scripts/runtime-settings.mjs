import { writeFile } from 'node:fs/promises';
import { validateRuntimeSettings } from '../src/models/runtime-settings.ts';
/** @param {Record<string, string | undefined>} environment */
export function buildRuntimeSettings(environment) {
  const region = environment.DYNAMODB_REGION || environment.AWS_REGION || environment.S3_REGION;
  if (environment.AWS_APP_ID && !region)
    throw new Error('Managed authentication requires an explicit account-store region.');
  return validateRuntimeSettings({
    version: 1,
    managed: Boolean(environment.AWS_APP_ID),
    region: region || 'us-east-2',
    usersTable: environment.DYNAMODB_USERS_TABLE || undefined,
    whitelistTable: environment.DYNAMODB_WHITELIST_TABLE || undefined,
    authUrl: environment.AUTH_URL || environment.NEXTAUTH_URL || undefined,
    secretArn: environment.DASHBOARD_AUTH_SECRET_ARN || undefined,
  });
}
/** @param {Record<string, string | undefined>} environment @param {string} path */
export async function writeRuntimeSettings(environment, path) {
  // Only the explicit non-secret fields above cross the build/runtime boundary.
  await writeFile(path, JSON.stringify(buildRuntimeSettings(environment)) + '\n', { mode: 0o600 });
}
