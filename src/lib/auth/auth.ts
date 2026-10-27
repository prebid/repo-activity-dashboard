import 'server-only';
import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getBaseAuthConfig } from './base-config';
import { authorizeCredentials } from './credential-policy';
import { credentialSchema } from '@/models/accounts';
import { isPreviewBuild, previewAccounts } from '@/lib/presentation/preview';
import { AccountError } from './account-errors';
import { readWithConflictRetry } from './account-reader';

class TemporaryCredentialExpired extends CredentialsSignin {
  code = 'temporary_expired';
}

const authentication = NextAuth(async () => ({
  ...(await getBaseAuthConfig()),
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (isPreviewBuild) {
          const parsed = credentialSchema.safeParse(credentials);
          if (!parsed.success || parsed.data.password !== 'preview') return null;
          return previewAccounts.find((user) => user.email === parsed.data.email) ?? null;
        }
        const [{ getServerAccountStore }, { verifyPassword }] = await Promise.all([
          import('./server-account-store'),
          import('./passwords'),
        ]);
        try {
          return await authorizeCredentials(credentials, {
            lookup: (email) =>
              readWithConflictRetry((signal) =>
                getServerAccountStore().getCredentialSnapshot(email, signal),
              ),
            verify: verifyPassword,
          });
        } catch (error) {
          if (error instanceof AccountError && error.code === 'expired')
            throw new TemporaryCredentialExpired();
          throw error;
        }
      },
    }),
  ],
}));

// Internal protocol implementation; pages/APIs must use the current-viewer boundary.
export const rawHandlers = authentication.handlers;
