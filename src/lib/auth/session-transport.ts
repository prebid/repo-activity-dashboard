import 'server-only';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { rawHandlers } from './auth';
import { sessionClaimsSchema } from './session-policy';
import { getRuntimeSettings } from './runtime-settings';
import { isPreviewBuild } from '@/lib/presentation/preview';
import { AuthStateError } from './auth-errors';
export const verifiedSessionSchema = z.object({ user: sessionClaimsSchema, expires: z.string() });
export type VerifiedSession = z.infer<typeof verifiedSessionSchema>;
export function authOrigin(): string {
  const value = isPreviewBuild ? process.env.AUTH_URL : getRuntimeSettings().authUrl;
  if (!value) throw new AuthStateError('configuration');
  return new URL(value).origin;
}
export async function parseVerifiedSession(response: Response): Promise<VerifiedSession | null> {
  if (!response.ok) throw new AuthStateError('configuration');
  const data: unknown = await response.clone().json();
  if (data === null) return null;
  const parsed = verifiedSessionSchema.safeParse(data);
  if (!parsed.success) throw new AuthStateError('configuration');
  return parsed.data;
}
export async function readVerifiedSession(headers: Headers): Promise<VerifiedSession | null> {
  const request = new NextRequest(authOrigin() + '/api/auth/session', {
    headers: { cookie: headers.get('cookie') ?? '' },
  });
  return parseVerifiedSession(await rawHandlers.GET(request));
}
