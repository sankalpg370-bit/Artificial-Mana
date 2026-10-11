import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, POST } from "../app/api/admin-access/route.js";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_ACCESS_MAX_AGE_SECONDS,
  createTemporaryAdminToken,
  isValidTemporaryAdminToken,
  matchesTemporaryAdminKey,
} from "../lib/admin-access.js";
import { proxy } from "../proxy.js";

const previousKey = process.env.ADMIN_TEMP_ACCESS_KEY;
const now = 1_800_000_000_000;

afterEach(() => {
  if (previousKey === undefined) delete process.env.ADMIN_TEMP_ACCESS_KEY;
  else process.env.ADMIN_TEMP_ACCESS_KEY = previousKey;
});

describe("temporary admin access", () => {
  it("compares supplied keys without accepting empty values", () => {
    expect(matchesTemporaryAdminKey("test-key", "test-key")).toBe(true);
    expect(matchesTemporaryAdminKey("wrong-key", "test-key")).toBe(false);
    expect(matchesTemporaryAdminKey("", "test-key")).toBe(false);
    expect(matchesTemporaryAdminKey("test-key", "")).toBe(false);
  });

  it("accepts only a valid, unexpired, correctly signed portal token", () => {
    const token = createTemporaryAdminToken("test-key", now);
    expect(isValidTemporaryAdminToken(token, "test-key", now)).toBe(true);
    expect(isValidTemporaryAdminToken(token, "wrong-key", now)).toBe(false);
    expect(isValidTemporaryAdminToken(`${token}x`, "test-key", now)).toBe(false);
    expect(isValidTemporaryAdminToken(token, "test-key", now + ADMIN_ACCESS_MAX_AGE_SECONDS * 1000)).toBe(false);
    expect(isValidTemporaryAdminToken(token, "", now)).toBe(false);
  });

  it("sets a short-lived HttpOnly cookie only when the key is correct", async () => {
    process.env.ADMIN_TEMP_ACCESS_KEY = "temporary-test-key";
    const response = await POST(new Request("http://localhost/api/admin-access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "temporary-test-key" }),
    }));

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(`${ADMIN_ACCESS_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=strict");
    const token = setCookie.split(`${ADMIN_ACCESS_COOKIE}=`)[1].split(";")[0];
    expect(isValidTemporaryAdminToken(token, process.env.ADMIN_TEMP_ACCESS_KEY)).toBe(true);
  });

  it("rejects wrong keys and disables access when no key is configured", async () => {
    process.env.ADMIN_TEMP_ACCESS_KEY = "temporary-test-key";
    const rejected = await POST(new Request("http://localhost/api/admin-access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "wrong-key" }),
    }));
    expect(rejected.status).toBe(401);

    delete process.env.ADMIN_TEMP_ACCESS_KEY;
    const disabled = await POST(new Request("http://localhost/api/admin-access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "temporary-test-key" }),
    }));
    expect(disabled.status).toBe(503);
  });

  it("redirects requests without a valid portal cookie and allows valid cookies", () => {
    process.env.ADMIN_TEMP_ACCESS_KEY = "temporary-test-key";
    const locked = proxy(new NextRequest("http://localhost/admin"));
    expect(locked.status).toBe(307);
    expect(locked.headers.get("location")).toBe("http://localhost/admin/access");

    expect(proxy(new NextRequest("http://localhost/admin/access")).status).toBe(200);

    const unlockedRequest = new NextRequest("http://localhost/admin");
    unlockedRequest.cookies.set(ADMIN_ACCESS_COOKIE, createTemporaryAdminToken(process.env.ADMIN_TEMP_ACCESS_KEY));
    expect(proxy(unlockedRequest).status).toBe(200);
  });

  it("clears the access cookie when locking the portal", async () => {
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(`${ADMIN_ACCESS_COOKIE}=`);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
