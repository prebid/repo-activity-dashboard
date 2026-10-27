import { auth } from "./auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { safeReturnPath } from "@/lib/presentation/navigation";

export async function requirePageAccess(
  options: { allowPasswordChange?: boolean; admin?: boolean } = {},
) {
  const session = await auth();
  const destination = safeReturnPath(headers().get("x-dashboard-return-path"));
  if (!session?.user?.id || !session.user.email)
    redirect("/auth/login?callbackUrl=" + encodeURIComponent(destination));
  if (session.user.mustChangePassword && !options.allowPasswordChange)
    redirect(
      "/auth/change-password?callbackUrl=" + encodeURIComponent(destination),
    );
  if (options.admin && session.user.role !== "admin") redirect("/");
  return session.user;
}

export const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export async function requireDataAccess() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email)
    return NextResponse.json(
      { error: "Sign in required" },
      { status: 401, headers: privateHeaders },
    );
  if (session.user.mustChangePassword)
    return NextResponse.json(
      { error: "Set your password before continuing" },
      { status: 403, headers: privateHeaders },
    );
  return null;
}
