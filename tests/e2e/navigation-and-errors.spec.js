const { test, expect } = require("@playwright/test");

test("public navigation, page titles, missing courses, and management gate work", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "About" }).click();
  await expect(page).toHaveTitle("About | Artificial Mana");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About Artificial Mana");
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveTitle("Privacy Policy | Artificial Mana");
  await page.getByRole("link", { name: "All courses", exact: true }).click();
  await expect(page.locator("#courses")).toBeVisible();
  const missing = await page.goto("/course/nonexistent-audit-course");
  // Next returns 200 for streamed not-found responses and 404 before streaming.
  expect([200, 404]).toContain(missing.status());
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/management$/);
  await expect(page.getByRole("main")).toHaveCount(1);
  await page.getByLabel("Temporary access key").fill("incorrect-audit-key");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "not correct" })).toBeVisible();
  await page.goto("/creator-studio");
  await expect(page.getByText("You must sign in with a creator account to access this page.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("classroom session failures offer retry without switching to guest storage", async ({ page }) => {
  let fail = true;
  await page.route("**/api/account", (route) => fail
    ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ data: null, error: { message: "Unavailable" } }) })
    : route.continue());
  await page.goto("/course/intro-to-ai");
  await expect(page.getByRole("alert").filter({ hasText: "sign-in status could not be checked" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Notes", exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Notes", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Notes", exact: true }).press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Quiz", exact: true })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Quiz", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("API rejects unauthenticated writes, cross-origin mutations and invalid envelopes", async ({ request, baseURL }) => {
  const origin = { Origin: baseURL };
  const anonymous = await request.post("/api/data", { headers: origin, data: { table: "notes", op: "insert", payload: { course_slug: "intro-to-ai", lesson_id: "l1", content: "Forbidden" } } });
  expect(anonymous.status()).toBe(401);
  const crossOrigin = await request.post("/api/account", { headers: { Origin: "https://untrusted.example" }, data: { action: "logout" } });
  expect(crossOrigin.status()).toBe(403);
  const invalid = await request.post("/api/data", { headers: origin, data: [] });
  expect(invalid.status()).toBe(400);
  const privateRows = await request.post("/api/data", { headers: origin, data: { table: "notes" } });
  expect(privateRows.status()).toBe(200);
  expect((await privateRows.json()).data).toEqual([]);
});
