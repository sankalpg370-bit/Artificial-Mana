import { NextResponse } from "next/server";
import { ADMIN_ACCESS_COOKIE, isValidTemporaryAdminToken } from "./lib/admin-access";

export function proxy(request) {
  if (request.nextUrl.pathname === "/admin/access") {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  if (isValidTemporaryAdminToken(token, process.env.ADMIN_TEMP_ACCESS_KEY)) {
    return NextResponse.next();
  }

  const accessUrl = new URL("/admin/access", request.url);
  return NextResponse.redirect(accessUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
