const { loadEnvConfig } = require("@next/env");
const { defineConfig } = require("@playwright/test");

loadEnvConfig(process.cwd(), true);

const testProjectRef = process.env.E2E_TEST_PROJECT_REF?.trim();
const liveProjectRef = process.env.E2E_LIVE_PROJECT_REF?.trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const adminEmail = process.env.E2E_ADMIN_EMAIL?.trim();
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const baseURL = process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:3000";

if (!testProjectRef || !liveProjectRef || !supabaseUrl || !supabaseAnonKey || !adminEmail || !adminPassword) {
  throw new Error(
    "Browser tests need E2E_TEST_PROJECT_REF, E2E_LIVE_PROJECT_REF, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, E2E_ADMIN_EMAIL, and E2E_ADMIN_PASSWORD in .env.local."
  );
}

if (testProjectRef === liveProjectRef) {
  throw new Error("The browser test project must be different from the live Supabase project.");
}

const databaseHost = new URL(supabaseUrl).hostname;
if (databaseHost !== `${testProjectRef}.supabase.co`) {
  throw new Error(
    "E2E_TEST_PROJECT_REF must match NEXT_PUBLIC_SUPABASE_URL. Use a separate test project, never the live project."
  );
}

const target = new URL(baseURL);
if (!["localhost", "127.0.0.1"].includes(target.hostname)) {
  throw new Error("Browser tests only run against the local site. Do not point them at production.");
}

module.exports = defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: `npm run dev -- --hostname ${target.hostname} --port ${target.port || "3000"}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
