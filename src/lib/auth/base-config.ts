import type {} from 'next-auth/jwt';
import type { NextAuthConfig } from 'next-auth';
import { getSecret } from './get-secret';
import { sessionClaimsSchema } from './session-policy';
import { isPreviewBuild } from '@/lib/presentation/preview';
import type { AccountRole } from '@/models/accounts';
import { getRuntimeSettings } from './runtime-settings';
import { AuthStateError } from './auth-errors';
import { safeErrorCode } from './diagnostics';

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
  if (!isPreviewBuild) {
    const { authUrl } = getRuntimeSettings();
    if (!authUrl) throw new AuthStateError('configuration');
    // NextAuth reads AUTH_URL after this factory resolves to set origin and secure-cookie defaults.
    process.env.AUTH_URL = authUrl;
  }
  const legacy = !isPreviewBuild && getRuntimeSettings().authBackend === 'legacy';
  return {
    secret: await getSecret(),
    session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
    pages: { signIn: '/auth/login', error: '/auth/error' },
    logger: {
      error(error) {
        console.error('Authentication request failed', {
          code: safeErrorCode(error),
        });
      },
    },
    callbacks: {
      jwt({ token, user }) {
        if (user) {
          token.id = user.id!;
          token.email = user.email;
          token.authVersion = user.authVersion ?? (isPreviewBuild ? 0 : undefined);
        }
        // Identity/revision are the token contract; profile and permissions come from current storage.
        for (const field of ['name', 'picture', 'role', 'company', 'mustChangePassword'] as const)
          delete token[field];
        if (legacy && token.authVersion === undefined) token.authVersion = 0;
        if (!sessionClaimsSchema.safeParse(token).success) return null;
        return token;
      },
      session({ session, token }) {
        const claims = sessionClaimsSchema.parse(token);
        session.user = {
          id: claims.id,
          email: claims.email,
          authVersion: claims.authVersion,
          emailVerified: null,
        };
        return session;
      },
    },
  };
}
