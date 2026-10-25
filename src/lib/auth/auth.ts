import 'server-only';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getBaseAuthConfig } from './base-config';
import { authorizeCredentials } from './credential-policy';
import { credentialSchema } from '@/models/accounts';
import { isPreviewBuild, previewAccounts } from '@/lib/presentation/preview';

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...getBaseAuthConfig(),
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
        const [{ isEmailWhitelisted }, { getUserByEmail }, { verifyPassword }] = await Promise.all([
          import('./whitelist'),
          import('./users'),
          import('./passwords'),
        ]);
        return authorizeCredentials(credentials, {
          isAllowed: isEmailWhitelisted,
          findByEmail: getUserByEmail,
          verify: verifyPassword,
        });
      },
    }),
  ],
}));
