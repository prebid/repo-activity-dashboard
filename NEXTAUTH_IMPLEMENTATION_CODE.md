# NextAuth JWT Implementation Code

This file contains all the actual implementation code for our authentication system using NextAuth with JWT sessions and DynamoDB.

## 1. AWS Clients (`src/lib/aws/clients.ts`)

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";

const config = {
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
};

export const dynamoClient = new DynamoDBClient(config);
export const docClient = DynamoDBDocumentClient.from(dynamoClient);
export const s3Client = new S3Client(config);
```

## 2. Password Management (`src/lib/auth/passwords.ts`)

```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

## 3. Whitelist Utilities (`src/lib/auth/whitelist.ts`)

```typescript
import { docClient } from "@/lib/aws/clients";
import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const WHITELIST_TABLE = process.env.DYNAMODB_WHITELIST_TABLE!;

export async function isEmailWhitelisted(email: string): Promise<boolean> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: WHITELIST_TABLE,
        Key: { email: email.toLowerCase() },
      })
    );

    return result.Item?.isActive === true;
  } catch (error) {
    console.error("Whitelist check error:", error);
    return false;
  }
}

export async function addToWhitelist(
  email: string,
  role: string = "viewer",
  addedBy: string = "system"
) {
  await docClient.send(
    new PutCommand({
      TableName: WHITELIST_TABLE,
      Item: {
        email: email.toLowerCase(),
        isActive: true,
        role,
        addedBy,
        addedAt: Date.now(),
      },
    })
  );
}

export async function getAllWhitelistedEmails() {
  const result = await docClient.send(
    new ScanCommand({
      TableName: WHITELIST_TABLE,
    })
  );

  return result.Items || [];
}
```

## 4. User Management (`src/lib/auth/users.ts`)

```typescript
import { docClient } from "@/lib/aws/clients";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE!;

export interface User {
  id: string;
  email: string;
  password: string;
  name?: string;
  role?: string;
  company?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: "email-index",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email.toLowerCase(),
        },
        Limit: 1,
      })
    );

    return result.Items?.[0] as User | null;
  } catch (error) {
    console.error("Get user by email error:", error);
    return null;
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { id },
      })
    );

    return result.Item as User | null;
  } catch (error) {
    console.error("Get user by ID error:", error);
    return null;
  }
}

export async function createUser(userData: {
  email: string;
  password: string; // Should be hashed before calling
  name?: string;
  role?: string;
  company?: string;
}): Promise<User> {
  const user: User = {
    id: uuidv4(),
    email: userData.email.toLowerCase(),
    password: userData.password,
    name: userData.name || userData.email.split("@")[0],
    role: userData.role || "viewer",
    company: userData.company,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: user,
    })
  );

  return user;
}
```

## 5. NextAuth Configuration (`src/lib/auth/auth.ts`)

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";
import { isEmailWhitelisted } from "./whitelist";
import { verifyPassword } from "./passwords";
import { getUserByEmail, createUser } from "./users";
import { docClient } from "@/lib/aws/clients";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      role?: string;
      company?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string;
    role?: string;
    company?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
    company?: string;
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
        };
      },
    }),

    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,

      async profile(profile) {
        // Check whitelist for Google signins
        if (!(await isEmailWhitelisted(profile.email))) {
          throw new Error("Your email is not authorized. Contact administrator.");
        }

        // Check if user exists, create if not
        let user = await getUserByEmail(profile.email);

        if (!user) {
          // Save Google user to accounts table
          const ACCOUNTS_TABLE = process.env.DYNAMODB_ACCOUNTS_TABLE!;
          await docClient.send(
            new PutCommand({
              TableName: ACCOUNTS_TABLE,
              Item: {
                id: profile.sub,
                provider: "google",
                providerAccountId: profile.sub,
                email: profile.email,
                name: profile.name,
                image: profile.picture,
              },
            })
          );
        }

        return {
          id: profile.sub,
          email: profile.email,
          name: profile.name,
          image: profile.picture,
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
      }
      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email,
        name: token.name,
        role: token.role,
        company: token.company,
      };
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
});
```

## 6. Registration API Route (`src/app/api/auth/register/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/passwords";
import { createUser, getUserByEmail } from "@/lib/auth/users";
import { isEmailWhitelisted } from "@/lib/auth/whitelist";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    // Check whitelist
    if (!(await isEmailWhitelisted(email))) {
      return NextResponse.json(
        { error: "Your email is not authorized. Contact administrator." },
        { status: 403 }
      );
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const user = await createUser({
      email,
      password: hashedPassword,
      name: name || email.split("@")[0],
    });

    return NextResponse.json({
      message: "Registration successful",
      userId: user.id,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
```

## 7. NextAuth API Route (`src/app/api/auth/[...nextauth]/route.ts`)

```typescript
import { handlers } from "@/lib/auth/auth";

export const { GET, POST } = handlers;
```

## 8. Middleware (`src/middleware.ts`)

```typescript
import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const session = await auth();
  const isAuthPage = req.nextUrl.pathname.startsWith("/auth");

  if (!session && !isAuthPage) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  if (session && isAuthPage) {
    // Redirect to home if authenticated and trying to access auth pages
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Check admin routes
  if (req.nextUrl.pathname.startsWith("/admin")) {
    if (!session || session.user.role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

## 9. Login Page (`src/app/auth/login/page.tsx`)

```typescript
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Sign In</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Repository Activity Dashboard
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              Sign in with Google
            </Button>
          </div>

          <div className="text-center">
            <Link
              href="/auth/register"
              className="text-sm text-primary hover:underline"
            >
              Don't have an account? Register
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
```

## 10. Registration Page (`src/app/auth/register/page.tsx`)

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
      } else {
        // Registration successful, redirect to login
        router.push("/auth/login?registered=true");
      }
    } catch (error) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Create Account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Register for Repository Activity Dashboard
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                At least 8 characters, with uppercase, lowercase, and number
              </p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>

          <div className="text-center">
            <Link
              href="/auth/login"
              className="text-sm text-primary hover:underline"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
```

## 11. Protected Layout (`src/app/(protected)/layout.tsx`)

```typescript
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  return <>{children}</>;
}
```

## 12. User Menu Component (`src/components/layout/user-menu.tsx`)

```typescript
"use client";

import { signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

interface UserMenuProps {
  user: {
    email: string;
    name?: string;
    role?: string;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <User className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.name || user.email}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            {user.role && (
              <p className="text-xs text-muted-foreground capitalize">
                Role: {user.role}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === "admin" && (
          <>
            <DropdownMenuItem asChild>
              <a href="/admin">Admin Dashboard</a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => signOut()}>
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## 13. Update Toolbar (`src/components/layout/toolbar.tsx`)

Add to your existing toolbar component:

```typescript
import { auth } from "@/lib/auth/auth";
import { UserMenu } from "./user-menu";

export async function Toolbar() {
  const session = await auth();

  return (
    <header className="...your existing styles...">
      {/* Your existing navigation */}

      {/* Add user menu to the right side */}
      {session && (
        <div className="ml-auto">
          <UserMenu user={session.user} />
        </div>
      )}
    </header>
  );
}
```

## Usage Notes

1. **JWT Sessions**: Sessions are stored as encrypted cookies, not in DynamoDB
2. **Whitelist Required**: Users must be in the whitelist table to register/login
3. **Password Security**: Passwords are hashed with bcrypt before storage
4. **Role-based Access**: Admin routes check for `role: "admin"`
5. **Google OAuth**: Optional, still requires whitelist entry

## Testing Locally

1. Create the 3 DynamoDB tables
2. Add your email to whitelist
3. Install dependencies
4. Set environment variables
5. Run `npm run dev`
6. Visit http://localhost:3000
7. Register with your whitelisted email
8. Login and test protected routes