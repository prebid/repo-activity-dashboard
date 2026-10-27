import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";
import { safeReturnPath } from "@/lib/presentation/navigation";

export const middleware = auth((request) => {
  const path = request.nextUrl.pathname;
  const origin = new URL(process.env.NEXTAUTH_URL || request.url).origin;
  const protocol =
    /^\/api\/auth\/(csrf|session|providers|signin|signout|callback|error)(\/|$)/.test(
      path,
    );
  if (
    path === "/api/health" ||
    path === "/auth/login" ||
    path === "/auth/error" ||
    protocol
  )
    return NextResponse.next();
  const data =
    path.startsWith("/api/") || path === "/store" || path.startsWith("/store/");
  const user = request.auth?.user;
  const destination = safeReturnPath(path + request.nextUrl.search);
  const redirect = (target: string) => {
    const url = new URL(target, origin);
    url.searchParams.set("callbackUrl", destination);
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  const deny = (status: number, error: string) =>
    NextResponse.json(
      { error },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  if (!user?.id || !user.email)
    return data ? deny(401, "Sign in required") : redirect("/auth/login");
  if (
    user.mustChangePassword &&
    path !== "/auth/change-password" &&
    path !== "/api/auth/change-password"
  )
    return data
      ? deny(403, "Set your password before continuing")
      : redirect("/auth/change-password");
  const admin =
    path.startsWith("/admin") ||
    path.startsWith("/api/admin") ||
    path === "/auth/setup" ||
    path.startsWith("/api/auth/setup") ||
    path === "/api/auth/test";
  if (admin && user.role !== "admin")
    return data
      ? deny(403, "Administrator access required")
      : NextResponse.redirect(new URL("/", origin));
  const headers = new Headers(request.headers);
  headers.set("x-dashboard-return-path", destination);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|prebid-logo.png|images/).*)",
  ],
};
