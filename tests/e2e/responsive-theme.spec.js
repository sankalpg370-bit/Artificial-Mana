const { expect, test } = require("@playwright/test");

test("home page fits desktop and phone screens in both themes", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("artificial-mana-theme", "dark");
  });

  await page.goto("/");
  await expect(page.getByRole("heading", {
    level: 1,
    name: "Learn artificial intelligence, one lesson at a time",
  })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.setViewportSize({ width: 390, height: 844 });
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
