const { test, expect } = require("@playwright/test");

async function fits(page) {
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
}

for (const width of [320, 390, 768, 1280]) {
  test(`course browsing and persistent themes fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await fits(page);
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("searchbox").fill("no course matches this query");
    await expect(page.getByText(/No course found/)).toBeVisible();
    await page.getByRole("searchbox").fill("");
    await page.locator(".course-card").first().click();
    await expect(page.getByRole("tab", { name: "Notes", exact: true })).toBeVisible();
    await fits(page);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    if (width === 390) await page.screenshot({ path: "test-results/classroom-mobile.png", fullPage: true });
  });
}

test("notes, lesson selection, bookmarks and drawings persist across reloads", async ({ page }) => {
  // Exercise player integration deterministically without downloading a third-party video.
  await page.addInitScript(() => {
    window.YT = { Player: class {
      constructor(id, options) {
        this.options = options;
        window.testPlayer = this;
        queueMicrotask(() => options.events.onReady({ target: this }));
      }
      loadVideoById() {}
      getCurrentTime() { return 15; }
      seekTo(seconds) { window.lastSeek = seconds; }
      playVideo() {}
      destroy() {}
    } };
  });
  await page.goto("/course/intro-to-ai");
  await page.getByRole("button", { name: "Save course" }).click();
  const editor = page.getByLabel("Write a note for this lesson");
  await editor.fill("A persistent note");
  await page.getByRole("button", { name: "Save note at 0:15" }).click();
  await expect(page.locator(".note .rich")).toHaveText("A persistent note");
  await page.reload();
  await expect(page.getByRole("button", { name: /Saved/ })).toBeVisible();
  await expect(page.locator(".note .rich")).toHaveText("A persistent note");
  await page.getByRole("button", { name: "▶ 0:15" }).click();
  await expect.poll(() => page.evaluate(() => window.lastSeek)).toBe(15);
  await page.getByRole("button", { name: "Delete note" }).click();
  await expect(page.locator(".note .rich")).toHaveCount(0);
  await page.getByRole("tab", { name: "Boards", exact: true }).click();
  await page.getByRole("button", { name: "Open chalkboard" }).click();
  const canvas = page.locator("canvas.wb-canvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 100, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("board:intro-to-ai:l1"))?.strokes?.length || 0)).toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Next →" }).click();
  const title = await page.locator(".player-row h2").innerText();
  await page.reload();
  await expect(page.locator(".player-row h2")).toHaveText(title);
});

test("unconfigured sign-in fails gracefully", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("student@example.com");
  await page.getByLabel("Password", { exact: true }).fill("testpassword");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Sign-in is temporarily unavailable");
});
