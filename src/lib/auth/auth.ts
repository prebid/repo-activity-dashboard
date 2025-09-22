import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
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
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Check whitelist
        if (!(await isEmailWhitelisted(email))) {
          throw new Error("Your email is not authorized. Contact administrator.");
        }

        // Get user and verify password
        const user = await getUserByEmail(email);
        if (!user) {
          throw new Error("No account found with this email");
        }

        const isValidPassword = await verifyPassword(password, user.password);
        if (!isValidPassword) {
          throw new Error("Invalid password");
        }

        // Return user without password
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
        email: token.email,
        name: token.name || undefined,
        role: token.role || undefined,
        company: token.company || undefined,
        mustChangePassword: token.mustChangePassword,
      };
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
});