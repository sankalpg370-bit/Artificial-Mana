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
  sameSite: "strict",
  path: "/admin",
  maxAge: ADMIN_ACCESS_MAX_AGE_SECONDS,
};

export async function POST(request) {
  const expectedKey = process.env.ADMIN_TEMP_ACCESS_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: "Temporary admin access is not enabled." }, { status: 503 });
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Enter the temporary access key." }, { status: 400 });
  }
  if (rawBody.length > 1024) {
    return NextResponse.json({ error: "The request is too large." }, { status: 413 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Enter the temporary access key." }, { status: 400 });
  }

  if (!body || typeof body.key !== "string" || body.key.length > 512) {
    return NextResponse.json({ error: "Enter the temporary access key." }, { status: 400 });
  }
  if (!matchesTemporaryAdminKey(body.key, expectedKey)) {
    return NextResponse.json({ error: "That access key is not correct." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_ACCESS_COOKIE, createTemporaryAdminToken(expectedKey), cookieOptions);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_ACCESS_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
