import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AuthenticatedUser } from '@/models/accounts';
import { previewAccounts, isPreviewBuild } from '@/lib/presentation/preview';
import { safeReturnPath } from '@/lib/presentation/navigation';
import { readVerifiedSession, type VerifiedSession } from './session-transport';
import { currentIdentity } from './session-policy';
import { getServerAccountStore } from './server-account-store';
import { readWithConflictRetry } from './account-reader';
import { AuthStateError } from './auth-errors';
import { AccountDataError } from './account-errors';
import { safeErrorCode } from './diagnostics';
export type ViewerDecision =
  | { kind: 'authenticated'; user: AuthenticatedUser }
  | { kind: 'anonymous' }
  | { kind: 'unavailable' | 'configuration' | 'integrity' };
export function failedViewer(error: unknown): {
  kind: 'unavailable' | 'configuration' | 'integrity';
} {
  const kind =
    error instanceof AuthStateError
      ? error.kind
      : error instanceof AccountDataError
        ? 'integrity'
        : 'unavailable';
  console.error('Authentication boundary failure', { kind, code: safeErrorCode(error) });
  return { kind };
}
export async function resolveViewer(session: VerifiedSession | null): Promise<ViewerDecision> {
  if (!session) return { kind: 'anonymous' };
  if (isPreviewBuild) {
    const user = previewAccounts.find(
      (u) => u.id === session.user.id && u.email === session.user.email,
    );
    return user
      ? { kind: 'authenticated', user: { ...user, authVersion: 0 } }
      : { kind: 'anonymous' };
  }
  try {
    const snapshot = await readWithConflictRetry((signal) =>
      getServerAccountStore().getAccountSnapshot(session.user.id, session.user.email, signal),
    );
    const user = currentIdentity(session.user, snapshot);
    return user ? { kind: 'authenticated', user } : { kind: 'anonymous' };
  } catch (error) {
    return failedViewer(error);
  }
}
export const getViewer = cache(async () => {
  const requestHeaders = await headers();
  try {
    return await resolveViewer(await readVerifiedSession(requestHeaders));
  } catch (error) {
    return failedViewer(error);
  }
});
export async function requireViewer(
  options: { admin?: boolean; allowPasswordChange?: boolean } = {},
): Promise<AuthenticatedUser> {
  const decision = await getViewer();
  if (decision.kind === 'anonymous') {
    const destination = safeReturnPath((await headers()).get('x-dashboard-return-path'));
    redirect('/auth/login?callbackUrl=' + encodeURIComponent(destination));
  }
  if (decision.kind !== 'authenticated') throw new AuthStateError(decision.kind);
  if (decision.user.mustChangePassword && !options.allowPasswordChange)
    redirect('/auth/change-password');
  if (options.admin && (isPreviewBuild || decision.user.role !== 'admin')) redirect('/repos');
  return decision.user;
}
