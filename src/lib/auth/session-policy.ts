import { z } from 'zod';
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
  if (!token.success || !userResult.success || !accessResult.success) return null;
  const user = userResult.data;
  const access = accessResult.data;
  if (
    user.id !== token.data.id ||
    user.email !== token.data.email ||
    user.authVersion !== token.data.authVersion ||
    access.email !== user.email ||
    !access.isActive ||
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
