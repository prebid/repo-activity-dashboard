import type {} from 'next-auth/jwt';
import type { NextAuthConfig } from 'next-auth';
import { getSecret } from './get-secret';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role?: string;
      company?: string;
      mustChangePassword?: boolean;
    };
  }
  interface User {
    role?: string;
    company?: string;
    mustChangePassword?: boolean;
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role?: string;
    company?: string;
    mustChangePassword?: boolean;
  }
}
export function getBaseAuthConfig(): Omit<NextAuthConfig, 'providers'> {
  return {
    trustHost: true,
    secret: getSecret(),
    session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
    pages: { signIn: '/auth/login', error: '/auth/error' },
    callbacks: {
      jwt({ token, user }) {
        if (user) {
          token.id = user.id!;
          token.email = user.email;
          token.name = user.name;
          token.role = user.role;
          token.company = user.company;
          token.mustChangePassword = user.mustChangePassword;
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
          emailVerified: null,
        };
        return session;
      },
    },
  };
}
