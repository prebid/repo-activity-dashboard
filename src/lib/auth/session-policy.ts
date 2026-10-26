import { temporaryCredentialCurrent } from '@/models/temporary-credentials';
import { z } from 'zod';
import { AccountDataError } from './account-errors';
import {
  accountRecordSchema,
  whitelistRecordSchema,
  accountRoles,
  type AuthenticatedUser,
} from '@/models/accounts';
export const sessionClaimsSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  authVersion: z.number().int().nonnegative().safe(),
});
export interface AccountSnapshot {
  user: unknown;
  access: unknown;
}
export function currentIdentity(
  claims: unknown,
  snapshot: AccountSnapshot,
): AuthenticatedUser | null {
  const token = sessionClaimsSchema.safeParse(claims);
  const userResult = accountRecordSchema.safeParse(snapshot.user);
  const accessResult = whitelistRecordSchema.safeParse(snapshot.access);
  if (!token.success || snapshot.user == null || snapshot.access == null) return null;
  if (!userResult.success || !accessResult.success)
    throw new AccountDataError([
      ...(!userResult.success
        ? [
            {
              table: 'users' as const,
              key: token.data.id,
              fields: userResult.error.issues.map((i) => i.path.join('.')),
            },
          ]
        : []),
      ...(!accessResult.success
        ? [
            {
              table: 'whitelist' as const,
              key: token.data.email,
              fields: accessResult.error.issues.map((i) => i.path.join('.')),
            },
          ]
        : []),
    ]);
  const user = userResult.data;
  const access = accessResult.data;
  if (
    user.id !== token.data.id ||
    user.email !== token.data.email ||
    user.authVersion !== token.data.authVersion ||
    access.email !== user.email ||
    !access.isActive ||
    !temporaryCredentialCurrent(user) ||
    (access.userId && access.userId !== user.id)
  )
    return null;
  const rank = Math.min(accountRoles.indexOf(user.role), accountRoles.indexOf(access.role));
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    company: user.company,
    role: accountRoles[rank],
    mustChangePassword: user.mustChangePassword,
    authVersion: user.authVersion,
  };
}
