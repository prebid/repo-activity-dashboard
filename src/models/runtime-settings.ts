import { z } from 'zod';
import { temporaryPasswordHoursSchema } from './temporary-credentials.ts';
import { accountRegionSchema, accountTableNameSchema } from './account-target.ts';
export const runtimeSettingsSchema = z
  .object({
    version: z.literal(1),
    managed: z.boolean(),
    temporaryPasswordHours: temporaryPasswordHoursSchema.optional(),
    region: accountRegionSchema.optional(),
    usersTable: accountTableNameSchema.optional(),
    whitelistTable: accountTableNameSchema.optional(),
    authUrl: z.string().url().optional(),
    secretArn: z
      .string()
      .regex(
        /^arn:aws(?:-us-gov|-cn)?:secretsmanager:[a-z0-9-]+:\d{12}:secret:[A-Za-z0-9/_+=.@-]+$/,
      )
      .optional(),
  })
  .strict();
export type RuntimeSettings = z.infer<typeof runtimeSettingsSchema>;
export function validateRuntimeSettings(input: unknown): RuntimeSettings {
  const settings = runtimeSettingsSchema.parse(input);
  if (settings.usersTable && settings.usersTable === settings.whitelistTable)
    throw new Error('Account and whitelist tables must be distinct.');
  if (settings.authUrl) {
    const url = new URL(settings.authUrl);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      !['https:', 'http:'].includes(url.protocol)
    )
      throw new Error('Authentication URL must be a plain HTTP(S) origin.');
    if (settings.managed && url.protocol !== 'https:')
      throw new Error('Managed authentication requires HTTPS.');
  }
  if (
    settings.managed &&
    (!settings.region ||
      !settings.usersTable ||
      !settings.whitelistTable ||
      !settings.authUrl ||
      !settings.secretArn)
  )
    throw new Error(
      'Managed authentication requires tables, HTTPS origin, region, and a Secrets Manager ARN.',
    );
  return settings;
}
