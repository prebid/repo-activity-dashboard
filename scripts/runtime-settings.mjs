import { writeFile, chmod } from 'node:fs/promises';
import { validateRuntimeSettings } from '../src/models/runtime-settings.ts';
/** @param {Record<string, string | undefined>} environment */
export function buildRuntimeSettings(environment) {
  const region = environment.DYNAMODB_REGION;
  if (environment.AWS_APP_ID && !region)
    throw new Error('Managed authentication requires an explicit account-store region.');
  return validateRuntimeSettings({
    version: 1,
    temporaryPasswordHours: environment.DASHBOARD_TEMP_PASSWORD_HOURS ?? undefined,
    managed: Boolean(environment.AWS_APP_ID),
    region: region || undefined,
    usersTable: environment.DYNAMODB_USERS_TABLE || undefined,
    whitelistTable: environment.DYNAMODB_WHITELIST_TABLE || undefined,
    authUrl: environment.AUTH_URL || environment.NEXTAUTH_URL || undefined,
    secretArn: environment.DASHBOARD_AUTH_SECRET_ARN || undefined,
  });
}
/** @param {Record<string, string | undefined>} environment @param {string} path */
export async function writeRuntimeSettings(environment, path) {
  // Only the explicit non-secret fields above cross the build/runtime boundary.
  await writeRuntimeFile(path, JSON.stringify(buildRuntimeSettings(environment)) + '\n');
}
/** @param {string} path @param {string | Buffer} content */
export async function writeRuntimeFile(path, content) {
  await writeFile(path, content, { mode: 0o644 });
  // Explicit chmod handles restrictive umasks and an existing file's previous mode.
  await chmod(path, 0o644);
}
