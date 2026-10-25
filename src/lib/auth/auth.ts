import 'server-only';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getBaseAuthConfig } from './base-config';
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
        if (typeof credentials.email !== 'string' || typeof credentials.password !== 'string')
          return null;
        if (isPreviewBuild) {
          if (credentials.password !== 'preview') return null;
          return previewAccounts.find((user) => user.email === credentials.email) ?? null;
        }
        const [{ isEmailWhitelisted }, { getUserByEmail }, { verifyPassword }] = await Promise.all([
          import('./whitelist'),
          import('./users'),
          import('./passwords'),
        ]);
        if (!(await isEmailWhitelisted(credentials.email))) return null;
        const user = await getUserByEmail(credentials.email);
        if (!user || !(await verifyPassword(credentials.password, user.password))) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          company: user.company,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
}));
