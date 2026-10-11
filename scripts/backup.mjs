import * as sqlite from "node:sqlite";
import { cp, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { database, dataDirectory, closeDatabases } from "../lib/server/database.mjs";

// Run with the app stopped so the database and uploaded files form one consistent snapshot.
try {
  const directory = resolve(process.argv[2] || join(process.cwd(), "backups", new Date().toISOString().replace(/[:.]/g, "-")));
  const data = dataDirectory();
  if (directory === data || directory.startsWith(data + "/") || directory.startsWith(data + "\\")) throw new Error("Keep backups outside DATA_DIR.");
  await mkdir(directory, { recursive: true });
  await sqlite.backup(database(), join(directory, "artificialmana.sqlite"));
  await cp(join(data, "uploads"), join(directory, "uploads"), { recursive: true }).catch((error) => { if (error.code !== "ENOENT") throw error; });
  console.log(`Backup written to ${directory}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { closeDatabases(); }
