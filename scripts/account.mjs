import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createUser, hashPassword, credentials } from "../lib/server/auth.mjs";
import { database, closeDatabases } from "../lib/server/database.mjs";

async function secret() {
  if (!stdin.isTTY) {
    if (process.env.ACCOUNT_PASSWORD) return process.env.ACCOUNT_PASSWORD;
    throw new Error("Use an interactive terminal or set ACCOUNT_PASSWORD for automated setup.");
  }
  stdout.write("Password (at least 10 characters; hidden): ");
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => {
      stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", input); stdout.write("\n");
      if (error) reject(error); else resolve(value);
    };
    const input = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") { finish(new Error("Cancelled.")); return; }
        if (character === "\r" || character === "\n") { finish(); return; }
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    };
    stdin.on("data", input);
  });
}
try {
  const command = process.argv[2] || "create-admin";
  if (!["create-admin", "reset-password"].includes(command)) throw new Error("Use create-admin or reset-password.");
  let email = process.env.ACCOUNT_EMAIL;
  if (!email) {
    const prompt = createInterface({ input: stdin, output: stdout });
    email = await prompt.question("Account email: ");
    prompt.close();
  }
  const password = await secret();
  if (command === "create-admin") {
    const existing = database().prepare("SELECT id FROM users WHERE email=?").get(email.trim().toLowerCase());
    // Never promote an existing account merely because its email matches a public signup.
    if (existing) throw new Error("That account already exists. Use a different email; existing accounts are not promoted automatically.");
    await createUser(email, password, "admin");
    stdout.write("Admin account created in the local database.\n");
  } else {
    const clean = credentials(email, password);
    const user = database().prepare("SELECT id FROM users WHERE email=?").get(clean.email);
    if (!user) throw new Error("Account not found.");
    const hash = await hashPassword(clean.password);
    database().prepare("UPDATE users SET password_hash=? WHERE id=?").run(hash, user.id);
    database().prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
    stdout.write("Password changed; all existing sessions for this account were revoked.\n");
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { closeDatabases(); }
