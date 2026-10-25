import { NextResponse } from 'next/server';
import { auth } from './auth';
import { accountAccess } from './access-policy';
import { isPreviewBuild } from '@/lib/presentation/preview';
import { getRuntimeSettings } from './runtime-settings';
import { accountMutationPolicy } from './mutation-policy';
export async function requireAccountAccess(
  options: { admin?: boolean; allowPasswordChange?: boolean } = {},
) {
  // Deny preview before even evaluating the real session/account configuration.
  const user = isPreviewBuild ? null : (await auth())?.user;
  const decision = accountAccess(user, { ...options, preview: isPreviewBuild });
  return decision.allowed
    ? { ok: true as const, user: decision.user }
    : {
        ok: false as const,
        response: NextResponse.json({ error: decision.error }, { status: decision.status }),
      };
}
export async function requireAccountMutationAccess(
  request: Request,
  options: { admin?: boolean; allowPasswordChange?: boolean } = {},
) {
  if (!isPreviewBuild) {
    const decision = accountMutationPolicy(request.headers, getRuntimeSettings().authUrl);
    if (!decision.allowed)
      return {
        ok: false as const,
        response: NextResponse.json({ error: decision.error }, { status: decision.status }),
      };
  }
  return requireAccountAccess(options);
}
