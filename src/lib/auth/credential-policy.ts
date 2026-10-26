import { temporaryCredentialCurrent } from '@/models/temporary-credentials';
import { credentialSchema, type AccountRecord, type AuthenticatedUser } from '@/models/accounts';
export interface CredentialDependencies {
  isAllowed: (email: string) => Promise<boolean>;
  findByEmail: (email: string) => Promise<AccountRecord | null>;
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
  const allowed = await dependencies.isAllowed(email);
  const user = allowed ? await dependencies.findByEmail(email) : null;
  const verified = await dependencies.verify(password, user?.password ?? dummyHash);
  if (!allowed || !user || !verified || !temporaryCredentialCurrent(user)) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    company: user.company,
    mustChangePassword: user.mustChangePassword,
    authVersion: user.authVersion,
  };
}
