const { rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
module.exports = async () => {
  const directory = process.env.E2E_DATA_DIR;
  if (directory?.startsWith(join(tmpdir(), "mana-e2e-"))) rmSync(directory, { recursive: true, force: true });
};
