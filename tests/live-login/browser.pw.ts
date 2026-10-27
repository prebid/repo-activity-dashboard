import { test, expect } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

test("anonymous pages and data are gated, including direct requests", async ({
  page,
  request,
}) => {
  for (const path of [
    "/",
    "/contributors",
    "/companies",
    "/repos/prebidjs",
    "/admin/users",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/auth/login");
    expect(new URL(response.headers().location).origin).toBe(
      "http://localhost:3300",
    );
  }
  for (const path of [
    "/api/report-data",
    "/api/repos",
    "/store/repos/prebid-js/open-prs.json",
    "/store/sheets/github-mapping.json",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    page.getByRole("button", { name: "Theme settings" }),
  ).toBeVisible();
});

test("existing admin creates a user, temporary password is changed, and original reports load", async ({
  page,
  browser,
  browserName,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/auth/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(browserName + "-admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("admin-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3300/");
  await expect(
    page.getByRole("button", { name: "Open PRs 45", exact: true }),
  ).toBeVisible();
  const baseline = await readFile(
    "report-data/repos/prebid-js/open-prs.json",
    "utf8",
  );
  const report = await page.request.get("/store/repos/prebid-js/open-prs.json");
  expect(report.status()).toBe(200);
  expect(await report.text()).toBe(baseline);
  const first = await (await page.request.get("/api/report-data")).json();
  const entries = Object.entries(first.data);
  for (let part = 1; part < first.pages; part++) {
    const response = await page.request.get("/api/report-data?page=" + part);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.version).toBe(first.version);
    entries.push(...Object.entries(body.data));
  }
  expect(Object.fromEntries(entries)).toEqual(
    JSON.parse(await readFile("contributor-repo-timeline.json", "utf8")).data,
  );
  expect(first.mapping).toEqual(
    JSON.parse(
      await readFile("report-data/sheets/github-mapping.json", "utf8"),
    ),
  );
  for (const route of [
    "/contributors",
    "/companies",
    "/repos/prebidjs",
    "/admin/users",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL("http://localhost:3300" + route);
    await expect(
      page.getByText("Loading reports…", { exact: true }),
    ).toHaveCount(0);
  }
  const created = await page.request.post("/api/admin/users", {
    data: { email: browserName + "-invite@example.test", role: "viewer" },
  });
  expect(created.status()).toBe(200);
  const credential = await created.json();
  expect(credential.tempPassword).toBeTruthy();
  const newcomer = await browser.newContext({
    baseURL: "http://localhost:3300",
  });
  try {
    const form = await newcomer.newPage();
    form.on("pageerror", (e) => errors.push(e.message));
    await form.goto("/auth/login?callbackUrl=%2Fcontributors");
    await form
      .getByLabel("Email", { exact: true })
      .fill(browserName + "-invite@example.test");
    await form
      .getByLabel("Password", { exact: true })
      .fill(credential.tempPassword);
    await form.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(form).toHaveURL(/\/auth\/change-password/);
    expect(
      (
        await newcomer.request.get("http://localhost:3300/api/report-data")
      ).status(),
    ).toBe(403);
    await form
      .getByLabel("Temporary Password", { exact: true })
      .fill(credential.tempPassword);
    await form.getByLabel("New Password", { exact: true }).fill("simple");
    await form
      .getByLabel("Confirm New Password", { exact: true })
      .fill("simple");
    await form
      .getByRole("button", { name: "Set password and continue" })
      .click();
    await expect(form).toHaveURL("http://localhost:3300/contributors");
    await expect(
      form.getByText("Loading reports…", { exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await newcomer.request.get(
          "http://localhost:3300/store/repos/prebid-js/open-prs.json",
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await newcomer.request.get("http://localhost:3300/api/admin/users")
      ).status(),
    ).toBe(403);
  } finally {
    await newcomer.close();
  }
  await page.screenshot({
    path: testInfo.outputPath("existing-admin.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("report data is absent from public assets and client bundles", async () => {
  const timeline = JSON.parse(
    await readFile("contributor-repo-timeline.json", "utf8"),
  );
  const canary = Object.keys(timeline.data).find((key) => key.length > 20)!;
  expect(canary).toBeTruthy();
  async function files(path: string): Promise<string[]> {
    const entries = await readdir(path, { withFileTypes: true });
    const result: string[] = [];
    for (const entry of entries)
      if (entry.isDirectory())
        result.push(...(await files(join(path, entry.name))));
      else result.push(join(path, entry.name));
    return result;
  }
  expect(
    (await files("public")).some(
      (path) => path.includes("/store/") || path.endsWith(".json"),
    ),
  ).toBe(false);
  for (const path of await files(".next/static"))
    if (path.endsWith(".js"))
      expect(await readFile(path, "utf8")).not.toContain(canary);
});

test("login padding and visibility controls stay aligned at phone, tablet and desktop widths", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/auth/login");
  await expect(page.locator("html")).toHaveClass(/dark/);
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const input = page.getByLabel("Password", { exact: true });
    await expect(input).toHaveCSS("padding-left", "12px");
    await expect(input).toHaveCSS("padding-right", "48px");
    const field = await input.boundingBox();
    const toggle = await page
      .getByRole("button", { name: "Show password", exact: true })
      .boundingBox();
    expect(field).not.toBeNull();
    expect(toggle).not.toBeNull();
    expect(toggle!.x).toBeGreaterThan(field!.x);
    expect(toggle!.x + toggle!.width).toBeLessThanOrEqual(
      field!.x + field!.width,
    );
    expect(toggle!.y).toBeGreaterThanOrEqual(field!.y);
    expect(toggle!.y + toggle!.height).toBeLessThanOrEqual(
      field!.y + field!.height,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page
      .getByRole("button", { name: "Show password", exact: true })
      .click();
    await expect(input).toHaveAttribute("type", "text");
    await page
      .getByRole("button", { name: "Hide password", exact: true })
      .click();
    await page.screenshot({
      path: testInfo.outputPath("dark-login-" + width + ".png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Theme settings", exact: true })
      .click();
    await page
      .getByRole("menuitemradio", { name: "Light", exact: true })
      .click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await page.screenshot({
      path: testInfo.outputPath("light-login-" + width + ".png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Theme settings", exact: true })
      .click();
    await page
      .getByRole("menuitemradio", { name: "Dark", exact: true })
      .click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  }
});
