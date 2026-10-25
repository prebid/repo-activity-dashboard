import { credentialSchema, type AccountRecord, type AuthenticatedUser } from '@/models/accounts';
export interface CredentialDependencies {
  isAllowed: (email: string) => Promise<boolean>;
  findByEmail: (email: string) => Promise<AccountRecord | null>;
  verify: (password: string, hash: string) => Promise<boolean>;
}
export async function authorizeCredentials(
  input: unknown,
  dependencies: CredentialDependencies,
): Promise<AuthenticatedUser | null> {
  const parsed = credentialSchema.safeParse(input);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;
  if (!(await dependencies.isAllowed(email))) return null;
  const user = await dependencies.findByEmail(email);
  if (!user || !(await dependencies.verify(password, user.password))) return null;
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
