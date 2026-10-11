import { NextResponse } from "next/server";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_ACCESS_MAX_AGE_SECONDS,
  createTemporaryAdminToken,
  matchesTemporaryAdminKey,
} from "../../../lib/admin-access";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: /** @type {"strict"} */ ("strict"),
  path: "/admin",
  maxAge: ADMIN_ACCESS_MAX_AGE_SECONDS,
};

const MAX_BODY_BYTES = 1024;

function jsonResponse(body, status) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readRequestBody(request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return { tooLarge: true };
  }

  const reader = request.body?.getReader();
  if (!reader) return { error: true };

  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return { tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { error: true };
  }
}

export async function POST(request) {
  const expectedKey = process.env.ADMIN_TEMP_ACCESS_KEY;
  if (!expectedKey) {
    return jsonResponse({ error: "Temporary admin access is not enabled." }, 503);
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(process.env.APP_ORIGIN || request.url).origin) {
        return jsonResponse({ error: "This request is not allowed." }, 403);
      }
    } catch {
      return jsonResponse({ error: "This request is not allowed." }, 403);
    }
  }

  const bodyResult = await readRequestBody(request);
  if (bodyResult.tooLarge) {
    return jsonResponse({ error: "The request is too large." }, 413);
  }
  if (bodyResult.error) {
    return jsonResponse({ error: "Enter the temporary access key." }, 400);
  }

  let body;
  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return jsonResponse({ error: "Enter the temporary access key." }, 400);
  }

  if (!body || typeof body.key !== "string" || body.key.length > 512) {
    return jsonResponse({ error: "Enter the temporary access key." }, 400);
  }
  if (!matchesTemporaryAdminKey(body.key, expectedKey)) {
    return jsonResponse({ error: "That access key is not correct." }, 401);
  }

  const response = jsonResponse({ ok: true }, 200);
  response.cookies.set(ADMIN_ACCESS_COOKIE, createTemporaryAdminToken(expectedKey), cookieOptions);
  return response;
}

export async function DELETE() {
  const response = jsonResponse({ ok: true }, 200);
  response.cookies.set(ADMIN_ACCESS_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
