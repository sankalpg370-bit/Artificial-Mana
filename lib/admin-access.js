import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const ADMIN_ACCESS_COOKIE = "am-admin-access";
export const ADMIN_ACCESS_MAX_AGE_SECONDS = 2 * 60 * 60;

function digest(value) {
  return createHash("sha256").update(value).digest();
}

export function matchesTemporaryAdminKey(candidate, expected) {
  if (!candidate || !expected) return false;
  return timingSafeEqual(digest(candidate), digest(expected));
}

export function createTemporaryAdminToken(key, now = Date.now()) {
  if (!key) throw new Error("A temporary admin access key is required.");
  const expiresAt = Math.floor(now / 1000) + ADMIN_ACCESS_MAX_AGE_SECONDS;
  const signature = createHmac("sha256", key).update(`admin-access:${expiresAt}`).digest("base64url");
  return `${expiresAt}.${signature}`;
}

export function isValidTemporaryAdminToken(token, key, now = Date.now()) {
  if (!token || !key) return false;
  const [expiresAtText, signature, ...extra] = token.split(".");
  if (!expiresAtText || !signature || extra.length) return false;

  const expiresAt = Number(expiresAtText);
  const nowSeconds = Math.floor(now / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds) return false;
  if (expiresAt > nowSeconds + ADMIN_ACCESS_MAX_AGE_SECONDS) return false;

  const expected = createHmac("sha256", key).update(`admin-access:${expiresAt}`).digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
