import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, openSync, closeSync } from "node:fs";
import { join } from "node:path";
import { dataDirectory } from "../lib/server/database.mjs";

const require = createRequire(import.meta.url);
const directory = dataDirectory();
mkdirSync(join(directory, "logs"), { recursive: true });
const log = openSync(join(directory, "logs", "server.log"), "a");
let child, timer, stopping = false;
function start() {
  if (stopping) return;
  child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", process.env.PORT || "3000"], {
    cwd: process.cwd(), env: process.env, windowsHide: true, stdio: ["ignore", log, log],
  });
  child.on("error", (error) => { console.error(error.message); });
  child.on("close", () => { if (!stopping) timer = setTimeout(start, 3000); });
}
function stop() {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  if (child && child.exitCode === null) child.kill();
  closeSync(log);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
start();
