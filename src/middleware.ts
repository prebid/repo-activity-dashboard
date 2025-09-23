import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Temporary bypass middleware for debugging
export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  console.log(`[Middleware] Processing request for: ${pathname}`);

  // Allow all requests to pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|store/.*\\.json).*)",
  ],
};