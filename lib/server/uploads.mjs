import { resolve, join, sep } from "node:path";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { dataDirectory, database } from "./database.mjs";
import { HttpError } from "./http.mjs";
export const FILE_TYPES = {
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv", txt: "text/plain", md: "text/markdown", epub: "application/epub+zip", zip: "application/zip",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
};
const MAX_BYTES = 25 * 1024 * 1024;
export function fileLocation(bucket, parts) {
  if (!["lesson-pdfs", "creator-materials"].includes(bucket) || !Array.isArray(parts) || !parts.length || parts.length > 6 || parts.some((part) => typeof part !== "string" || !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part) || part.includes("..") || part.length > 240)) throw new HttpError("Invalid file path.");
  const root = resolve(dataDirectory(), "uploads", bucket);
  const path = resolve(root, ...parts);
  if (!path.startsWith(root + sep)) throw new HttpError("Invalid file path.");
  return { path, name: parts.join("/"), type: FILE_TYPES[parts.at(-1).split(".").at(-1).toLowerCase()] };
}
function canWrite(bucket, parts, user) {
  if (!user || !["teacher", "admin"].includes(user.role)) throw new HttpError("Creator access is required.", user ? 403 : 401);
  if (bucket === "creator-materials" && user.role !== "admin" && parts[0] !== user.id) throw new HttpError("This upload belongs to another creator.", 403);
}
export async function uploadFile(request, bucket, parts, user) {
  canWrite(bucket, parts, user);
  const file = fileLocation(bucket, parts);
  if (!file.type || (bucket === "lesson-pdfs" && file.type !== "application/pdf")) throw new HttpError("Unsupported file type.", 415);
  if (request.headers.get("content-type")?.split(";")[0] !== file.type) throw new HttpError("File type does not match its extension.", 415);
  if (Number(request.headers.get("content-length") || 0) > MAX_BYTES) throw new HttpError("Files must be 25 MB or smaller.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("Choose a file.");
  const directory = join(file.path, "..");
  await mkdir(directory, { recursive: true });
  const handle = await open(file.path, "wx").catch((error) => {
    if (error.code === "EEXIST") throw new HttpError("A file already exists at this path.", 409);
    throw error;
  });
  let size = 0;
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new HttpError("Files must be 25 MB or smaller.", 413); }
      await handle.writeFile(value);
    }
    if (!size) throw new HttpError("The file is empty.");
    complete = true;
  } finally {
    reader.releaseLock();
    await handle.close();
    if (!complete) await unlink(file.path).catch(() => {});
  }
  return { path: file.name };
}
export async function downloadFile(bucket, parts, user) {
  const file = fileLocation(bucket, parts);
  if (bucket === "creator-materials" && user?.role !== "admin") {
    const row = database().prepare(`SELECT 1 FROM creator_materials m JOIN courses c ON c.slug=m.course_slug WHERE m.storage_path=? AND (m.creator_id=? OR (m.published=1 AND c.published=1))`).get(file.name, user?.id || "");
    if (!row) throw new HttpError("This file is unavailable.", 404);
  }
  try { return { ...file, bytes: await readFile(file.path) }; }
  catch (error) { if (error.code === "ENOENT") throw new HttpError("File not found.", 404); throw error; }
}
export async function removeFile(bucket, parts, user) {
  canWrite(bucket, parts, user);
  const file = fileLocation(bucket, parts);
  try { await unlink(file.path); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
