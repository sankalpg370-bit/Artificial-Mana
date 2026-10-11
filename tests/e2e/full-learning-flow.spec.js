const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { expect, test } = require("@playwright/test");

const uploadPath = path.join(__dirname, "fixtures", "e2e-material.txt");
const uploadText = "Artificial Mana browser test material.";

async function signIn(page, email, password) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function expectNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
}

async function installVideoTestDouble(page) {
  await page.addInitScript(() => {
    class TestPlayer {
      constructor(_elementId, options) {
        this.options = options;
        window.__endTestVideo = () => options.events.onStateChange({ data: 0 });
        window.setTimeout(() => options.events.onReady({ target: this }), 0);
      }

      loadVideoById() {}
      getCurrentTime() { return 42; }
      seekTo() {}
      playVideo() {}
    }

    window.YT = { Player: TestPlayer };
  });
}

test("visitor, student, and admin can complete the learning flow", async ({ browser }) => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 10);
  const courseTitle = `Browser Test ${runId}`;
  const courseSlug = courseTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const lessonTitle = "Browser Test Lesson";
  const studentEmail = `browser-test-${runId}@example.com`;
  const studentPassword = `Test-${runId}-Pass`;
  const noteText = `Browser test note ${runId}`;
  const commentText = `Browser test question ${runId}`;
  const materialTitle = `Browser test file ${runId}`;

  const studentContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const studentPage = await studentContext.newPage();
  await studentPage.addInitScript(() => {
    localStorage.setItem("artificial-mana-theme", "dark");
  });

  const adminContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const adminPage = await adminContext.newPage();
  await adminPage.addInitScript(() => {
    localStorage.setItem("artificial-mana-theme", "light");
  });

  try {
    await studentPage.goto("/");
    await expect(studentPage.getByRole("heading", {
      level: 1,
      name: "Learn artificial intelligence, one lesson at a time",
    })).toBeVisible();
    await expect(studentPage.locator("html")).toHaveAttribute("data-theme", "dark");
    await studentPage.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(studentPage.locator("html")).toHaveAttribute("data-theme", "light");

    await studentPage.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(studentPage);
    await studentPage.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(studentPage.locator("html")).toHaveAttribute("data-theme", "dark");

    await studentPage.goto("/login");
    await studentPage.getByLabel("Email").fill(studentEmail);
    await studentPage.getByLabel("Password").fill(studentPassword);
    await studentPage.getByRole("button", { name: "Sign up", exact: true }).click();
    await expect(studentPage.getByRole("button", { name: "Log out" })).toBeVisible();
    await studentPage.getByRole("button", { name: "Log out" }).click();
    await expect(studentPage.getByRole("link", { name: "Log in" })).toBeVisible();
    await signIn(studentPage, studentEmail, studentPassword);

    await signIn(
      adminPage,
      process.env.E2E_ADMIN_EMAIL,
      process.env.E2E_ADMIN_PASSWORD
    );
    await adminPage.goto("/admin");
    await expect(adminPage.getByRole("heading", { name: "New course" })).toBeVisible();
    await expect(adminPage.locator("html")).toHaveAttribute("data-theme", "light");
    await expectNoHorizontalOverflow(adminPage);

    const newCourse = adminPage.locator(".panel").filter({
      has: adminPage.getByRole("heading", { name: "New course" }),
    });
    await newCourse.getByPlaceholder("Title").fill(courseTitle);
    await newCourse.getByPlaceholder("Short description").fill("Course created by a browser test.");
    await newCourse.getByPlaceholder("Category (for example: Basics)").fill("Testing");
    await newCourse.getByRole("button", { name: "Make course" }).click();

    const courseEditor = adminPage.locator(".panel").filter({ hasText: courseTitle });
    await expect(courseEditor.getByRole("heading", { name: new RegExp(courseTitle) })).toBeVisible();
    await courseEditor.getByPlaceholder("Lesson title").fill(lessonTitle);
    await courseEditor.getByPlaceholder("Paste a YouTube link or video ID").fill("https://youtu.be/aircAruvnKk?si=shared");
    await courseEditor.getByRole("button", { name: "Add quiz question" }).click();
    await courseEditor.getByPlaceholder("Question 1").fill("What is two plus two?");
    await courseEditor.getByPlaceholder("Option 1").fill("Four");
    await courseEditor.getByPlaceholder("Option 2").fill("Five");
    await courseEditor.getByRole("button", { name: "Add lesson", exact: true }).click();
    await expect(courseEditor).toContainText(lessonTitle);
    await courseEditor.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(courseEditor).toContainText("(Published)");

    await adminPage.goto("/creator-studio");
    await expect(adminPage.getByRole("heading", { name: "Creator Studio" })).toBeVisible();
    await expectNoHorizontalOverflow(adminPage);
    await adminPage.getByLabel("Material type").selectOption("file");
    await adminPage.getByLabel("Course").selectOption(courseSlug);
    await adminPage.getByLabel("Lesson (optional)").selectOption({ label: lessonTitle });
    await adminPage.getByPlaceholder("Material title").fill(materialTitle);
    await adminPage.locator('input[type="file"]').setInputFiles(uploadPath);
    await adminPage.getByLabel("Visible to learners").check();
    await adminPage.getByRole("button", { name: "Save material" }).click();
    await expect(adminPage.getByRole("status")).toContainText("Material saved.");
    await expect(adminPage.getByRole("heading", { name: materialTitle })).toBeVisible();

    await installVideoTestDouble(studentPage);
    await studentPage.goto(`/course/${courseSlug}`);
    await expect(studentPage.getByRole("heading", { name: courseTitle })).toBeVisible();
    await expectNoHorizontalOverflow(studentPage);
    await expect(studentPage.getByRole("tab", { name: "Quiz" })).toBeVisible();
    await expect(studentPage.getByRole("tab", { name: "Materials" })).toBeVisible();

    await studentPage.locator('[contenteditable="true"][aria-label="Write a note for this lesson"]').fill(noteText);
    await studentPage.getByRole("button", { name: /Save note at/ }).click();
    await expect(studentPage.getByText(noteText)).toBeVisible();

    await studentPage.evaluate(() => {
      if (typeof window.__endTestVideo !== "function") {
        throw new Error("The test video player did not start.");
      }
      window.__endTestVideo();
    });
    await expect(studentPage.getByText("1 of 1 lessons done")).toBeVisible();

    await studentPage.getByRole("tab", { name: "Quiz" }).click();
    await studentPage.getByText("What is two plus two?").waitFor();
    await studentPage.getByLabel("Four").check();
    await studentPage.getByRole("button", { name: "Check answers" }).click();
    await expect(studentPage.getByText("You got 1 of 1.")).toBeVisible();
    await expect(studentPage.getByText("You finished this course!")).toBeVisible();

    await studentPage.getByPlaceholder("Your full name").fill("Browser Test Student");
    const [certificate] = await Promise.all([
      studentPage.waitForEvent("download"),
      studentPage.getByRole("button", { name: "Download certificate" }).click(),
    ]);
    expect(certificate.suggestedFilename()).toMatch(/^certificate-.*\.pdf$/);

    await studentPage.getByRole("tab", { name: "Questions" }).click();
    await studentPage.getByLabel("Your name").fill("Browser Test Student");
    await studentPage.getByLabel("Your comment").fill(commentText);
    await studentPage.getByRole("button", { name: "Post", exact: true }).click();
    await expect(studentPage.getByText(commentText)).toBeVisible();

    await studentPage.getByRole("tab", { name: "Materials" }).click();
    await expect(studentPage.getByRole("heading", { name: materialTitle })).toBeVisible();
    const [filePage] = await Promise.all([
      studentPage.waitForEvent("popup"),
      studentPage.getByRole("link", { name: "Open file" }).click(),
    ]);
    await expect(filePage.locator("body")).toContainText(uploadText);
  } finally {
    await adminContext.close();
    await studentContext.close();
  }
});
