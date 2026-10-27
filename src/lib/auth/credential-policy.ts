import { temporaryCredentialCurrent } from '@/models/temporary-credentials';
import {
  credentialSchema,
  effectiveAccountRole,
  type AccountRecord,
  type WhitelistRecord,
  type AuthenticatedUser,
} from '@/models/accounts';
import { AccountError } from './account-errors';
export interface CredentialDependencies {
  lookup: (
    email: string,
  ) => Promise<{ user: AccountRecord | null; access: WhitelistRecord | null }>;
  verify: (password: string, hash: string) => Promise<boolean>;
}
// Public dummy hash at the same work factor as real accounts; matching it never authorizes.
const dummyHash = '$2b$10$yw5lIvLQR1OnT9QDK5LYIeuIIybT3ZM6sVtSoWEg/e51V3W0TtAfq';
export async function authorizeCredentials(
  input: unknown,
  dependencies: CredentialDependencies,
): Promise<AuthenticatedUser | null> {
  const parsed = credentialSchema.safeParse(input);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;
  const { user, access } = await dependencies.lookup(email);
  const verified = await dependencies.verify(password, user?.password ?? dummyHash);
  if (!user || !access?.isActive || access.userId !== user.id || user.email !== email || !verified)
    return null;
  if (!temporaryCredentialCurrent(user)) throw new AccountError('expired');
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: effectiveAccountRole(user.role, access.role),
    company: user.company,
    mustChangePassword: user.mustChangePassword,
    authVersion: user.authVersion,
  };
}
