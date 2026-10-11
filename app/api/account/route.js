import { credentials, createUser, hashPassword, passwordMatches, issueSession, sessionUser, revokeSession, sessionCookie, rateLimit } from "../../../lib/server/auth.mjs";
import { database } from "../../../lib/server/database.mjs";
import { HttpError, json, failure, readJson, requireSameOrigin } from "../../../lib/server/http.mjs";
export const runtime = "nodejs";

export async function GET(request) {
  try {
    const user = sessionUser(request);
    return json({ data: { session: user ? { user: { id: user.id, email: user.email } } : null }, error: null });
  } catch (error) { return failure(error); }
}
export async function POST(request) {
  try {
    requireSameOrigin(request);
    const body = await readJson(request, 16384);
    if (body.action === "logout") {
      revokeSession(request);
      const response = json({ data: { session: null }, error: null });
      response.headers.set("Set-Cookie", sessionCookie(null, request));
      return response;
    }
    if (!["signup", "login"].includes(body.action)) throw new HttpError("Unknown account action.");
    const clean = credentials(body.email, body.password);
    // The Windows deployment binds localhost; only the trusted tunnel forwards this header.
    const address = request.headers.get("cf-connecting-ip") || "local";
    rateLimit(`auth-address:${address}`, 30, 900);
    rateLimit(`auth-email:${clean.email}`, 15, 900);
    let user;
    if (body.action === "signup") {
      if (process.env.DISABLE_SIGNUP === "1") throw new HttpError("Registration is currently closed.", 403);
      user = await createUser(clean.email, clean.password);
    } else {
      const stored = database().prepare("SELECT id,email,password_hash FROM users WHERE email=?").get(clean.email);
      const valid = stored ? await passwordMatches(clean.password, stored.password_hash) : (await hashPassword(clean.password), false);
      if (!valid) throw new HttpError("Email or password is incorrect.", 401);
      user = { id: stored.id, email: stored.email };
    }
    const token = issueSession(user);
    const response = json({ data: { user, session: { user } }, error: null });
    response.headers.set("Set-Cookie", sessionCookie(token, request));
    return response;
  } catch (error) { return failure(error); }
}
