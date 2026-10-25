import type {} from 'next-auth/jwt';
import type { NextAuthConfig } from 'next-auth';
import { getSecret } from './get-secret';
import { currentIdentity, sessionClaimsSchema } from './session-policy';
import { isPreviewBuild } from '@/lib/presentation/preview';
import type { AccountRole } from '@/models/accounts';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role?: AccountRole;
      company?: string;
      mustChangePassword?: boolean;
      authVersion: number;
    };
  }
  interface User {
    role?: AccountRole;
    company?: string;
    mustChangePassword?: boolean;
    authVersion?: number;
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role?: AccountRole;
    company?: string;
    mustChangePassword?: boolean;
    authVersion?: number;
  }
}
export async function getBaseAuthConfig(): Promise<Omit<NextAuthConfig, 'providers'>> {
  return {
    trustHost: true,
    secret: await getSecret(),
    session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
    pages: { signIn: '/auth/login', error: '/auth/error' },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id!;
          token.email = user.email;
          token.name = user.name;
          token.role = user.role;
          token.company = user.company;
          token.mustChangePassword = user.mustChangePassword;
          token.authVersion = user.authVersion ?? (isPreviewBuild ? 0 : undefined);
        }
        if (!isPreviewBuild) {
          const claims = sessionClaimsSchema.safeParse(token);
          if (!claims.success) return null;
          const { getAccountSnapshot } = await import('./users');
          const identity = currentIdentity(
            claims.data,
            await getAccountSnapshot(claims.data.id, claims.data.email),
          );
          if (!identity) return null;
          Object.assign(token, identity);
        }
        return token;
      },
      session({ session, token }) {
        session.user = {
          id: token.id,
          email: token.email ?? '',
          name: token.name,
          role: token.role,
          company: token.company,
          mustChangePassword: token.mustChangePassword,
          authVersion: token.authVersion ?? 0,
          emailVerified: null,
        };
        return session;
      },
    },
  };
}
