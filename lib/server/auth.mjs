import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { database, transaction } from "./database.mjs";
import { HttpError } from "./http.mjs";
const derive = promisify(scrypt);
export const SESSION_COOKIE = "am-session";
const MAX_AGE = 30 * 24 * 60 * 60;
const digest = (value) => createHash("sha256").update(value).digest("hex");

export function credentials(email, password) {
  if (typeof email !== "string" || typeof password !== "string") throw new HttpError("Enter an email and password.");
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || password.length < 10 || password.length > 256) throw new HttpError("Use a valid email and a password of 10–256 characters.");
  return { email: normalized, password };
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export async function passwordMatches(password, stored) {
  const [, salt, expected] = stored.split(":");
  const hash = await derive(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const bytes = Buffer.from(expected || "", "hex");
  return bytes.length === hash.length && timingSafeEqual(bytes, hash);
}
export async function createUser(email, password, role = "student") {
  const clean = credentials(email, password);
  const hash = await hashPassword(clean.password);
  const db = database();
  const user = { id: randomUUID(), email: clean.email };
  transaction(db, () => {
    if (db.prepare("SELECT 1 FROM users WHERE email=?").get(user.email)) throw new HttpError("An account with this email already exists.", 409);
    db.prepare("INSERT INTO users VALUES (?,?,?,?)").run(user.id, user.email, hash, new Date().toISOString());
    db.prepare("INSERT INTO profiles VALUES (?,?)").run(user.id, role);
  });
  return user;
}
export function rateLimit(key, maximum, seconds) {
  const db = database();
  const now = Math.floor(Date.now() / 1000);
  db.prepare("DELETE FROM rate_limits WHERE expires_at <= ?").run(now);
  const name = digest(key);
  const row = db.prepare("SELECT count FROM rate_limits WHERE key=?").get(name);
  if (row?.count >= maximum) throw new HttpError("Too many attempts. Please try again later.", 429);
  db.prepare("INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1").run(name, now + seconds);
}
export function issueSession(user) {
  const token = randomBytes(32).toString("hex");
  const now = Math.floor(Date.now() / 1000);
  database().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  database().prepare("INSERT INTO sessions VALUES (?,?,?)").run(digest(token), user.id, now + MAX_AGE);
  return token;
}
function tokenFrom(request) {
  const pair = (request.headers.get("cookie") || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = pair?.slice(SESSION_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function sessionUser(request) {
  const token = tokenFrom(request);
  if (!token) return null;
  const row = database().prepare(`SELECT u.id,u.email,p.role FROM sessions s JOIN users u ON u.id=s.user_id JOIN profiles p ON p.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?`).get(digest(token), Math.floor(Date.now() / 1000));
  return row || null;
}
export function revokeSession(request) {
  const token = tokenFrom(request);
  if (token) database().prepare("DELETE FROM sessions WHERE token_hash=?").run(digest(token));
}
export function sessionCookie(token, request) {
  const secure = new URL(process.env.APP_ORIGIN || request.url).protocol === "https:";
  return `${SESSION_COOKIE}=${token || ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? MAX_AGE : 0}${secure ? "; Secure" : ""}`;
}
