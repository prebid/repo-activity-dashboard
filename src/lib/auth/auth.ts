import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import { nextAuthSecret } from './get-secret';
import { isEmailWhitelisted } from "./whitelist";
import { verifyPassword } from "./passwords";
import { getUserByEmail } from "./users";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      role?: string;
      company?: string;
      mustChangePassword?: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string;
    role?: string;
    company?: string;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
    company?: string;
    mustChangePassword?: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: nextAuthSecret,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        console.log('[Auth] Authorize called with email:', credentials?.email);

        if (!credentials?.email || !credentials?.password) {
          console.log('[Auth] Missing credentials');
          throw new Error("Email and password are required");
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        try {
          // Check whitelist
          console.log('[Auth] Checking whitelist for:', email);
          const isWhitelisted = await isEmailWhitelisted(email);
          console.log('[Auth] Whitelist result:', isWhitelisted);

          if (!isWhitelisted) {
            throw new Error("Your email is not authorized. Contact administrator.");
          }

          // Get user and verify password
          console.log('[Auth] Getting user by email');
          const user = await getUserByEmail(email);
          console.log('[Auth] User found:', !!user);

          if (!user) {
            throw new Error("No account found with this email");
          }

          console.log('[Auth] Verifying password');
          const isValidPassword = await verifyPassword(password, user.password);
          console.log('[Auth] Password valid:', isValidPassword);

          if (!isValidPassword) {
            throw new Error("Invalid password");
          }

          // Return user without password
          console.log('[Auth] Authentication successful for:', email);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            company: user.company,
            mustChangePassword: user.mustChangePassword,
          };
        } catch (error: any) {
          console.error('[Auth] Error during authentication:', error.message);
          console.error('[Auth] Full error:', error);
          throw error;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email!;
        token.name = user.name;
        token.role = user.role;
        token.company = user.company;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email as string,
        name: token.name || undefined,
        role: token.role || undefined,
        company: token.company || undefined,
        mustChangePassword: token.mustChangePassword,
        emailVerified: null,
      };
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },

  debug: process.env.NODE_ENV === 'development',
});