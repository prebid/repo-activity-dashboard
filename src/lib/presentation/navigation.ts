export function safeReturnPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\\\r\n]/.test(value)
  )
    return "/";
  try {
    const url = new URL(value, "https://dashboard.invalid");
    if (url.origin !== "https://dashboard.invalid") return "/";
    if (
      url.pathname !== "/" &&
      ![
        "/repos",
        "/contributors",
        "/companies",
        "/foundation",
        "/admin/users",
      ].some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))
    )
      return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
