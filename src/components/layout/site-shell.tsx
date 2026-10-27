"use client";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, type ReactNode } from "react";
import { Toolbar } from "./toolbar";
import { ReportDataProvider } from "@/components/providers/report-data-provider";
import { safeReturnPath } from "@/lib/presentation/navigation";
export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const router = useRouter();
  const authPage = pathname.startsWith("/auth/");
  useEffect(() => {
    if (!authPage && status === "unauthenticated")
      router.replace(
        "/auth/login?callbackUrl=" +
          encodeURIComponent(
            safeReturnPath(window.location.pathname + window.location.search),
          ),
      );
  }, [authPage, status, router]);
  if (authPage) return <>{children}</>;
  if (status !== "authenticated")
    return (
      <p role="status" className="p-8">
        Checking sign-in…
      </p>
    );
  const summary =
    pathname === "/" ||
    pathname === "/contributors" ||
    pathname === "/companies";
  return (
    <>
      <Toolbar />
      <main className="flex-1">
        {summary ? (
          <ReportDataProvider key={session.user.id}>
            {children}
          </ReportDataProvider>
        ) : (
          children
        )}
      </main>
    </>
  );
}
