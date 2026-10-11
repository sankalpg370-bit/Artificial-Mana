import { sessionUser } from "../../../lib/server/auth.mjs";
import { executeQuery } from "../../../lib/server/query.mjs";
import { failure, json, readJson, requireSameOrigin, HttpError } from "../../../lib/server/http.mjs";
export const runtime = "nodejs";
export async function POST(request) {
  try {
    requireSameOrigin(request);
    const query = await readJson(request);
    return json(executeQuery(query, sessionUser(request)));
  } catch (error) {
    if (error.code?.startsWith("ERR_SQLITE") && !error.code.includes("BUSY")) return failure(new HttpError("Invalid record. Check required fields and linked courses."));
    return failure(error);
  }
}
