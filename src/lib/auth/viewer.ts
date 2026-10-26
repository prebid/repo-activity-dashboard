import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AuthenticatedUser } from '@/models/accounts';
import { previewAccounts, isPreviewBuild } from '@/lib/presentation/preview';
import { safeReturnPath } from '@/lib/presentation/navigation';
import { readVerifiedSession, type VerifiedSession } from './session-transport';
import { currentIdentity } from './session-policy';
import { getAccountSnapshot } from './users';
import { readWithConflictRetry } from './account-reader';
import { AuthStateError } from './auth-errors';
import { AccountDataError } from './account-errors';
export type ViewerDecision =
  | { kind: 'authenticated'; user: AuthenticatedUser }
  | { kind: 'anonymous' }
  | { kind: 'unavailable' | 'configuration' | 'integrity' };
const diagnosticCodes = new Set([
  'EACCES',
  'ENOENT',
  'ZodError',
  'SyntaxError',
  'AccessDeniedException',
  'ResourceNotFoundException',
  'TransactionCanceledException',
  'TimeoutError',
  'AbortError',
]);
export function failedViewer(error: unknown): {
  kind: 'unavailable' | 'configuration' | 'integrity';
} {
  const kind =
    error instanceof AuthStateError
      ? error.kind
      : error instanceof AccountDataError
        ? 'integrity'
        : 'unavailable';
  let cause = error;
  let code = 'Unknown';
  for (let depth = 0; depth < 4 && cause instanceof Error; depth++) {
    const candidate = 'code' in cause ? cause.code : cause.name;
    if (typeof candidate === 'string' && diagnosticCodes.has(candidate)) {
      code = candidate;
      break;
    }
    cause = cause.cause;
  }
  console.error('Authentication boundary failure', { kind, code, requestId: crypto.randomUUID() });
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
      getAccountSnapshot(session.user.id, session.user.email, signal),
    );
    const user = currentIdentity(session.user, snapshot);
    return user ? { kind: 'authenticated', user } : { kind: 'anonymous' };
  } catch (error) {
    return failedViewer(error);
  }
}
// This factory has request ownership; React cache below only deduplicates a render pass.
export function createViewerReader(requestHeaders: Headers) {
  let pending: Promise<ViewerDecision> | undefined;
  return () =>
    (pending ??= (async () => {
      try {
        return await resolveViewer(await readVerifiedSession(requestHeaders));
      } catch (error) {
        return failedViewer(error);
      }
    })());
}
export const getViewer = cache(async () => createViewerReader(await headers())());
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
