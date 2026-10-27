import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { splitTimeline } from "@/models/report-data";
import { safeReturnPath } from "@/lib/presentation/navigation";
import { validatePasswordStrength } from "@/models/password-policy";
const session = vi.hoisted(() => ({ value: null as any }));
vi.mock("@/lib/auth/auth", () => ({
  auth: (handler?: any) => handler ?? Promise.resolve(session.value),
}));
vi.mock("next/headers", () => ({
  headers: () =>
    new Headers({
      "x-dashboard-return-path": "/contributors?period=last-year",
    }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error("redirect:" + path);
  },
}));
import { middleware } from "@/middleware";
import { requireDataAccess, requirePageAccess } from "@/lib/auth/site-access";
import { readReportFile } from "@/lib/report-files";
beforeEach(() => {
  session.value = null;
  vi.stubEnv("NEXTAUTH_URL", "https://dashboard.example.test");
});
const user = {
  id: "test-user",
  email: "user@example.test",
  role: "viewer",
  mustChangePassword: false,
};
function gate(path: string, viewer: typeof user | null = null) {
  const request = Object.assign(
    new NextRequest("https://dashboard.example.test" + path),
    { auth: viewer ? { user: viewer } : null },
  );
  return (middleware as unknown as (request: unknown) => NextResponse)(request);
}
it.each([
  "/",
  "/contributors",
  "/companies",
  "/repos/prebidjs",
  "/admin/users",
])("requires a session for %s", (path) => {
  const response = gate(path);
  expect(response.status).toBe(307);
  expect(new URL(response.headers.get("location")!).pathname).toBe(
    "/auth/login",
  );
});
it.each([
  "/api/repos",
  "/api/report-data",
  "/store/repos/prebid-js/open-prs.json",
])("denies anonymous data at %s without redirecting to HTML", (path) => {
  expect(gate(path).status).toBe(401);
  expect(gate(path).headers.get("cache-control")).toContain("no-store");
});
it("requires temporary-password replacement before any reports or admin actions", () => {
  const temp = { ...user, role: "admin", mustChangePassword: true };
  expect(gate("/api/report-data", temp).status).toBe(403);
  expect(gate("/api/admin/users", temp).status).toBe(403);
  expect(
    new URL(
      gate("/contributors?period=last-year", temp).headers.get("location")!,
    ).searchParams.get("callbackUrl"),
  ).toBe("/contributors?period=last-year");
  expect(
    gate("/api/auth/change-password", temp).headers.get("x-middleware-next"),
  ).toBe("1");
});
it("keeps protocols public but admin and obsolete setup surfaces restricted", () => {
  for (const path of [
    "/auth/login",
    "/auth/error",
    "/api/auth/csrf",
    "/api/auth/session",
    "/api/auth/callback/credentials",
    "/api/health",
  ])
    expect(gate(path).headers.get("x-middleware-next")).toBe("1");
  expect(gate("/api/admin/users", user).status).toBe(403);
  expect(gate("/api/auth/setup", user).status).toBe(403);
  expect(
    gate("/api/admin/users", { ...user, role: "admin" }).headers.get(
      "x-middleware-next",
    ),
  ).toBe("1");
});
it("page and data guards enforce authorization independently of middleware", async () => {
  await expect(requirePageAccess()).rejects.toThrow(
    "redirect:/auth/login?callbackUrl=%2Fcontributors%3Fperiod%3Dlast-year",
  );
  expect((await requireDataAccess())?.status).toBe(401);
  session.value = { user: { ...user, mustChangePassword: true } };
  expect((await requireDataAccess())?.status).toBe(403);
  await expect(requirePageAccess()).rejects.toThrow(
    "redirect:/auth/change-password",
  );
  expect((await requirePageAccess({ allowPasswordChange: true })).id).toBe(
    "test-user",
  );
  session.value = { user };
  expect(await requireDataAccess()).toBe(null);
  await expect(requirePageAccess({ admin: true })).rejects.toThrow(
    "redirect:/",
  );
});
it("preserves only internal return destinations", () => {
  expect(safeReturnPath("/contributors?period=last-year")).toBe(
    "/contributors?period=last-year",
  );
  for (const path of [
    "https://elsewhere.test",
    "//elsewhere.test",
    "/\\elsewhere.test",
    "/auth/login",
  ])
    expect(safeReturnPath(path)).toBe("/");
});
it("keeps the approved password policy and byte bound", () => {
  expect(validatePasswordStrength("simple").valid).toBe(true);
  expect(validatePasswordStrength("short").valid).toBe(false);
  expect(validatePasswordStrength("🔑🔑🔑").valid).toBe(false);
  expect(validatePasswordStrength("x".repeat(73)).valid).toBe(false);
});
it("partitions transport without changing values and rejects an oversized record", () => {
  const data = JSON.parse(
    '{"a":{"value":"one"},"b":{"value":"two"},"__proto__":{"value":"kept"}}',
  );
  const parts = splitTimeline(data, 40);
  expect(parts.length).toBeGreaterThan(1);
  for (const part of parts)
    expect(
      new TextEncoder().encode(JSON.stringify(part)).length,
    ).toBeLessThanOrEqual(40);
  expect(
    Object.fromEntries(parts.flatMap((part) => Object.entries(part))),
  ).toEqual(data);
  expect(() => splitTimeline({ a: "x".repeat(50) }, 40)).toThrow(
    "response limit",
  );
});
it.each(
  [
    ["..", "package.json"],
    ["repos", "..", "package.json"],
    ["repos", "prebid-js", "..%2fpackage.json"],
    ["repos", "prebid-js", "file.js"],
  ].map((segments) => [segments]),
)("rejects report path escape or unsupported files %#", async (segments) => {
  await expect(readReportFile(segments)).rejects.toThrow("Invalid report path");
});
