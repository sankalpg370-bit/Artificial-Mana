export class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export function failure(error) {
  if (error instanceof HttpError) return json({ error: { message: error.message } }, error.status);
  console.error("Backend request failed.", error);
  return json({ error: { message: "The server could not complete this request. Please retry." } }, 500);
}
export function requireSameOrigin(request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  // Requiring Origin on mutations prevents cross-site requests with session cookies.
  if (!origin || origin !== new URL(expected).origin) throw new HttpError("This request is not allowed.", 403);
}
export async function readJson(request, limit = 2 * 1024 * 1024) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new HttpError("JSON is required.", 415);
  if (Number(request.headers.get("content-length") || 0) > limit) throw new HttpError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("Request body is required.");
  let size = 0;
  const parts = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError("Request is too large.", 413); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  let parsed;
  try { parsed = JSON.parse(Buffer.concat(parts).toString("utf8")); }
  catch { throw new HttpError("Invalid JSON."); }
  // Both API endpoints accept object envelopes; reject valid JSON primitives before field access.
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new HttpError("A JSON object is required.");
  return parsed;
}
