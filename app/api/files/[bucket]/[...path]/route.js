import { requireLocalBackend } from "../../../../../lib/backend-config";
import { sessionUser, rateLimit } from "../../../../../lib/server/auth.mjs";
import { downloadFile, uploadFile, removeFile } from "../../../../../lib/server/uploads.mjs";
import { json, failure, requireSameOrigin } from "../../../../../lib/server/http.mjs";
export const runtime = "nodejs";
export async function GET(request, { params }) {
  try {
    requireLocalBackend();
    const { bucket, path } = await params;
    const file = await downloadFile(bucket, path, sessionUser(request));
    const inline = ["application/pdf", "text/plain", "image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type);
    return new Response(file.bytes, { headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${path.at(-1)}"`,
      "Content-Length": String(file.bytes.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    } });
  } catch (error) { return failure(error); }
}
export async function POST(request, { params }) {
  try {
    requireLocalBackend();
    requireSameOrigin(request);
    const user = sessionUser(request);
    if (user) rateLimit(`upload:${user.id}`, 30, 3600);
    const { bucket, path } = await params;
    return json({ data: await uploadFile(request, bucket, path, user), error: null });
  } catch (error) { return failure(error); }
}
export async function DELETE(request, { params }) {
  try {
    requireLocalBackend();
    requireSameOrigin(request);
    const { bucket, path } = await params;
    await removeFile(bucket, path, sessionUser(request));
    return json({ data: null, error: null });
  } catch (error) { return failure(error); }
}
