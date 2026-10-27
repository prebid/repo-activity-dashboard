import { z } from 'zod';
import { AuthStateError } from './auth-errors';
export const previewSecret = 'local-preview-only-not-a-production-credential-2026';
const secretSchema = z
  .string()
  .min(32)
  .max(4096)
  .refine((value) => value.trim() === value && value !== previewSecret);
export function validateAuthSecret(input: unknown): string {
  const parsed = secretSchema.safeParse(input);
  if (!parsed.success)
    throw new AuthStateError(
      'configuration',
      undefined,
      'Production authentication requires its own secret of at least 32 characters.',
    );
  return parsed.data;
}
export function makeSecretLoader(
  read: (arn: string) => Promise<unknown>,
  now: () => number = Date.now,
) {
  let cached: { arn: string; value: string; expires: number } | undefined;
  let pending: { arn: string; promise: Promise<string> } | undefined;
  return async (arn: string): Promise<string> => {
    if (cached?.arn === arn && now() < cached.expires) return cached.value;
    if (pending?.arn === arn) return pending.promise;
    const promise = (async () => {
      try {
        let input = await read(arn);
        if (typeof input === 'string') {
          let object: unknown;
          try {
            object = JSON.parse(input);
          } catch {
            /* The documented raw form is not JSON. */
          }
          if (object && typeof object === 'object' && Object.hasOwn(object, 'authSecret')) {
            input = z.object({ authSecret: z.unknown() }).parse(object).authSecret;
          }
        }
        const value = validateAuthSecret(input);
        cached = { arn, value, expires: now() + 60_000 };
        return value;
      } catch (error) {
        if (error instanceof AuthStateError && error.kind === 'configuration') throw error;
        throw new AuthStateError(
          'unavailable',
          { cause: error },
          'Authentication secret is unavailable.',
        );
      }
    })();
    pending = { arn, promise };
    try {
      return await promise;
    } finally {
      if (pending?.promise === promise) pending = undefined;
    }
  };
}
