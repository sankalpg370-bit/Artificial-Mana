const { defineConfig } = require("@playwright/test");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

// E2E always owns an isolated local SQLite directory, never the real home-server data.
const directory = mkdtempSync(join(tmpdir(), "mana-e2e-"));
process.env.E2E_DATA_DIR = directory;
process.env.E2E_ADMIN_EMAIL = "test-admin@example.com";
process.env.E2E_ADMIN_PASSWORD = "TestAdminPassword123!";
module.exports = defineConfig({
  testDir: "./tests/e2e",
  globalSetup: require.resolve("./tests/e2e/setup.cjs"),
  globalTeardown: require.resolve("./tests/e2e/teardown.cjs"),
  fullyParallel: false, workers: 1, retries: 0, forbidOnly: Boolean(process.env.CI),
  timeout: 180000, expect: { timeout: 15000 }, reporter: "list",
  use: { baseURL: "http://127.0.0.1:3200", browserName: "chromium", viewport: { width: 1280, height: 800 }, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3200",
    url: "http://127.0.0.1:3200", reuseExistingServer: false, timeout: 120000,
    env: { DATA_DIR: directory, APP_ORIGIN: "http://127.0.0.1:3200", NEXT_PUBLIC_BACKEND: "local", NEXT_PUBLIC_LOCAL_ONLY: "0", ADMIN_TEMP_ACCESS_KEY: "local-e2e-portal-key-not-for-production" },
  },
});
