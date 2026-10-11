const { defineConfig } = require("@playwright/test");

// Public UI checks run without credentials or database writes. Full learning E2E
// remains in playwright.config.js with its separate-Supabase-project guard.
module.exports = defineConfig({
  testDir: "./tests/smoke",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", ADMIN_TEMP_ACCESS_KEY: "" },
    timeout: 120000,
  },
});
