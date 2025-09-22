import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const session = await auth();
  const pathname = req.nextUrl.pathname;

  // Define route types
  const isPublicRoute = pathname === "/" || pathname === "" || pathname.startsWith("/store");
  const isAuthRoute = pathname.startsWith("/auth");
  const isPasswordChangePage = pathname === "/auth/change-password";
  const isAdminRoute = pathname.startsWith("/admin");
  const isProtectedRoute = !isPublicRoute && !isAuthRoute;

  // If user is authenticated
  if (session) {
    // Check if user must change password (except if already on password change page)
    if (session.user.mustChangePassword && !isPasswordChangePage) {
      return NextResponse.redirect(new URL("/auth/change-password", req.url));
    }

    // Redirect from auth pages (except password change) if already logged in and password is set
    if (isAuthRoute && !isPasswordChangePage && !session.user.mustChangePassword) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Check admin routes - must have admin role
    if (isAdminRoute && session.user.role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // If user is NOT authenticated
  if (!session) {
    // Allow access to public routes and auth routes
    if (isPublicRoute || isAuthRoute) {
      return NextResponse.next();
    }

    // Redirect to login for protected routes
    if (isProtectedRoute) {
      // Store the attempted URL to redirect back after login
      const redirectUrl = new URL("/auth/login", req.url);
      redirectUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};