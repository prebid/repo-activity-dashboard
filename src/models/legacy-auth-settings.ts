import { z } from 'zod';
// Compatibility with the already deployed account configuration. Never public configuration.
export const legacyAuthSettingsSchema = z
  .object({
    secret: z.string().min(1),
    credentials: z
      .object({ accessKeyId: z.string().min(1), secretAccessKey: z.string().min(1) })
      .optional(),
  })
  .strict();
export type LegacyAuthSettings = z.infer<typeof legacyAuthSettingsSchema>;
export function legacyAuthSettings(
  environment: Record<string, string | undefined>,
): LegacyAuthSettings {
  const accessKeyId = environment.S3_ACCESS_KEY_ID;
  const secretAccessKey = environment.S3_SECRET_ACCESS_KEY;
  return legacyAuthSettingsSchema.parse({
    secret: environment.NEXTAUTH_SECRET || environment.AUTH_SECRET,
    // Never capture the hosting build role's temporary AWS_* credentials.
    credentials: accessKeyId || secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  });
}
