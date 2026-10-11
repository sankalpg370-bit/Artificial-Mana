const { spawnSync } = require("node:child_process");
module.exports = async () => {
  const result = spawnSync(process.execPath, ["scripts/account.mjs", "create-admin"], {
    env: { ...process.env, DATA_DIR: process.env.E2E_DATA_DIR, ACCOUNT_EMAIL: process.env.E2E_ADMIN_EMAIL, ACCOUNT_PASSWORD: process.env.E2E_ADMIN_PASSWORD }, encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || "Could not seed the isolated E2E admin.");
};
