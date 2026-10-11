import { randomUUID } from "node:crypto";
import { database, transaction } from "./database.mjs";
import { HttpError } from "./http.mjs";
import { rateLimit } from "./auth.mjs";

export const TABLES = {
  profiles: { columns: "user_id,role", keys: ["user_id"] },
  courses: { columns: "slug,title,description,category,published,created_at", keys: ["slug"] },
  lessons: { columns: "id,course_slug,position,title,youtube_id,pdf_url,quiz", keys: ["id"] },
  progress: { columns: "user_id,course_slug,lesson_id,completed_at", keys: ["user_id", "course_slug", "lesson_id"], owner: "user_id" },
  notes: { columns: "id,user_id,course_slug,lesson_id,seconds,content,created_at", keys: ["id"], owner: "user_id" },
  course_state: { columns: "user_id,course_slug,bookmarked,last_lesson,updated_at", keys: ["user_id", "course_slug"], owner: "user_id" },
  quiz_results: { columns: "user_id,course_slug,lesson_id,score,total,updated_at", keys: ["user_id", "course_slug", "lesson_id"], owner: "user_id" },
  boards: { columns: "user_id,course_slug,lesson_id,data,updated_at", keys: ["user_id", "course_slug", "lesson_id"], owner: "user_id" },
  lesson_boards: { columns: "course_slug,lesson_id,data,updated_at", keys: ["course_slug", "lesson_id"] },
  comments: { columns: "id,user_id,course_slug,lesson_id,parent_id,author_name,author_is_teacher,body,created_at", keys: ["id"] },
  creator_materials: { columns: "id,creator_id,course_slug,lesson_id,kind,title,content,url,file_url,storage_path,published,created_at,updated_at", keys: ["id"] },
};
const jsonColumns = new Set(["quiz", "data"]);
const boolColumns = new Set(["published", "bookmarked", "author_is_teacher"]);
const teacher = (user) => user?.role === "teacher" || user?.role === "admin";
const admin = (user) => user?.role === "admin";
const q = (name) => `"${name}"`;
export function decode(row) {
  if (!row) return row;
  const result = { ...row };
  for (const [key, value] of Object.entries(result)) {
    if (jsonColumns.has(key) && value != null) result[key] = JSON.parse(value);
    if (boolColumns.has(key)) result[key] = !!value;
  }
  return result;
}
function encode(key, value) {
  if (value === null) return null;
  if (jsonColumns.has(key)) return JSON.stringify(value);
  if (boolColumns.has(key)) return value ? 1 : 0;
  return value;
}
function readPolicy(table, user) {
  if (admin(user)) return ["1=1", []];
  const spec = TABLES[table];
  if (spec.owner || table === "profiles") return [user ? `${q(spec.owner || "user_id") }=?` : "1=0", user ? [user.id] : []];
  const published = `EXISTS (SELECT 1 FROM courses c WHERE c.slug=${q(table)}.course_slug AND c.published=1)`;
  if (table === "courses") return [teacher(user) ? "1=1" : "published=1", []];
  if (table === "lessons") return [teacher(user) ? "1=1" : published, []];
  if (table === "creator_materials") return [user ? `(creator_id=? OR (published=1 AND ${published}))` : `(published=1 AND ${published})`, user ? [user.id] : []];
  return [teacher(user) ? "1=1" : published, []];
}
function publishedCourse(db, slug) {
  if (typeof slug !== "string") return false;
  return !!db.prepare("SELECT 1 FROM courses WHERE slug=? AND published=1").get(slug);
}
function checkWrite(db, table, row, user, op) {
  if (!user) throw new HttpError("Please sign in.", 401);
  const spec = TABLES[table];
  if (!admin(user)) {
    if (spec.owner && row[spec.owner] !== user.id) throw new HttpError("This record belongs to another account.", 403);
    if (table === "profiles") throw new HttpError("Only admins can change account roles.", 403);
    if (["courses", "lessons", "lesson_boards"].includes(table) && !teacher(user)) throw new HttpError("Teacher access is required.", 403);
    if (table === "creator_materials" && (!teacher(user) || row.creator_id !== user.id)) throw new HttpError("This material belongs to another creator.", 403);
    if (table === "comments") {
      if (op === "delete") {
        if (!teacher(user) && row.user_id !== user.id) throw new HttpError("You cannot delete this comment.", 403);
      } else if (op !== "insert" || row.user_id !== user.id || !publishedCourse(db, row.course_slug)) throw new HttpError("You cannot change this comment.", 403);
    }
  }
  if (op === "delete") return;
  // Reject delayed saves to removed lessons instead of recreating orphaned learner data.
  if (spec.owner || table === "lesson_boards" || table === "comments") {
    if (typeof row.course_slug !== "string" || !row.course_slug) throw new HttpError("Choose a course.");
    if (!db.prepare("SELECT 1 FROM courses WHERE slug=?").get(row.course_slug)) throw new HttpError("This course no longer exists.");
    const lessonId = table === "course_state" ? row.last_lesson : table === "boards" && row.lesson_id?.endsWith(":diagram") ? row.lesson_id.slice(0, -8) : row.lesson_id;
    if (table !== "course_state" && (typeof lessonId !== "string" || !lessonId)) throw new HttpError("Choose a lesson in this course.");
    if (lessonId && !db.prepare("SELECT 1 FROM lessons WHERE id=? AND course_slug=?").get(lessonId, row.course_slug)) throw new HttpError("Choose a lesson in this course.");
  }
  if (table === "creator_materials") {
    if (row.storage_path && !row.storage_path.startsWith(`${row.creator_id}/`)) throw new HttpError("File ownership does not match the creator.");
    if (row.lesson_id && !db.prepare("SELECT 1 FROM lessons WHERE id=? AND course_slug=?").get(row.lesson_id, row.course_slug)) throw new HttpError("Choose a lesson in this course.");
  }
  if (table === "comments" && row.parent_id && !db.prepare("SELECT 1 FROM comments WHERE id=? AND course_slug=? AND lesson_id=? AND parent_id IS NULL").get(row.parent_id, row.course_slug, row.lesson_id)) throw new HttpError("Reply to an existing question in this lesson.");
}
function validateFields(table, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new HttpError("Invalid record.");
  const allowed = new Set(TABLES[table].columns.split(","));
  for (const [key, value] of Object.entries(payload)) {
    if (!allowed.has(key)) throw new HttpError(`Unknown field: ${key}`);
    if (value === null) continue;
    if (boolColumns.has(key) && typeof value !== "boolean") throw new HttpError(`Invalid ${key}.`);
    if (jsonColumns.has(key)) {
      if (typeof value !== "object" || JSON.stringify(value).length > 1500000) throw new HttpError(`Invalid ${key}.`);
      if (key === "quiz" && (!Array.isArray(value) || value.length > 1000 || value.some((question) => typeof question?.q !== "string" || !Array.isArray(question.options) || question.options.length < 2 || question.options.some((option) => typeof option !== "string") || !Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length))) throw new HttpError("Invalid quiz questions.");
    } else if (!boolColumns.has(key) && !["seconds", "position", "score", "total"].includes(key) && typeof value !== "string") throw new HttpError(`Invalid ${key}.`);
    if (typeof value === "string" && value.length > (key === "content" ? 100000 : 4000)) throw new HttpError(`${key} is too long.`);
    if (["seconds", "position", "score", "total"].includes(key) && (!Number.isSafeInteger(value) || value < 0)) throw new HttpError(`Invalid ${key}.`);
    if (["url", "file_url", "pdf_url"].includes(key) && value) {
      // URLs are displayed as links/iframes; reject executable schemes and protocol-relative links.
      if (!(typeof value === "string") || (value.startsWith("/") ? value.startsWith("//") : !/^https?:\/\//i.test(value))) throw new HttpError("Use an HTTP(S) URL or a local file path.");
    }
    if (key === "slug" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new HttpError("Invalid course address.");
  }
}
function defaults(table, payload, user) {
  const now = new Date().toISOString();
  const row = { ...payload };
  const columns = TABLES[table].columns.split(",");
  if (columns.includes("id")) row.id ||= randomUUID();
  if (columns.includes("created_at")) row.created_at ||= now;
  if (columns.includes("completed_at")) row.completed_at ||= now;
  if (columns.includes("updated_at")) row.updated_at = now;
  if (TABLES[table].owner) row[TABLES[table].owner] ||= user?.id;
  if (table === "creator_materials") row.creator_id ||= user?.id;
  if (table === "comments") {
    row.created_at = now;
    row.user_id ||= user?.id;
    if (!admin(user)) row.author_is_teacher = teacher(user);
    else row.author_is_teacher ??= teacher(user);
    row.parent_id ??= null;
  }
  if (table === "courses" || table === "creator_materials") row.published ??= false;
  if (table === "course_state") row.bookmarked ??= false;
  if (table === "notes") row.seconds ??= 0;
  if (table === "lessons") row.position ??= 1;
  return row;
}
function removeDependents(db, table, row) {
  const lessonTables = ["progress", "notes", "quiz_results", "boards", "lesson_boards", "comments"];
  if (table === "courses") {
    // These tables also support diagram IDs, so explicit cleanup complements the SQL FKs.
    for (const dependent of [...lessonTables, "course_state"]) db.prepare(`DELETE FROM ${q(dependent)} WHERE course_slug=?`).run(row.slug);
  } else if (table === "lessons") {
    for (const dependent of lessonTables) {
      const condition = dependent === "boards" ? "lesson_id IN (?,?)" : "lesson_id=?";
      const ids = dependent === "boards" ? [row.id, `${row.id}:diagram`] : [row.id];
      db.prepare(`DELETE FROM ${q(dependent)} WHERE course_slug=? AND ${condition}`).run(row.course_slug, ...ids);
    }
    db.prepare("UPDATE course_state SET last_lesson=NULL WHERE course_slug=? AND last_lesson=?").run(row.course_slug, row.id);
  }
}
function checkResourceIdentity(table, previous, next) {
  // UI renaming changes titles. Stable route/lesson IDs keep every learner's records attached.
  const keys = table === "courses" ? ["slug"] : table === "lessons" ? ["id", "course_slug"] : [];
  if (keys.some((key) => previous[key] !== next[key])) throw new HttpError("Course addresses and lesson identities cannot be changed. Edit the title instead.");
}
export function executeQuery(query, user = null) {
  if (!query || typeof query !== "object" || Array.isArray(query)) throw new HttpError("Invalid query.");
  const { table, op = "select", columns = "*", filters = [], order, range, single } = query || {};
  const spec = typeof table === "string" && Object.hasOwn(TABLES, table) ? TABLES[table] : null;
  if (!spec || !["select", "insert", "upsert", "update", "delete"].includes(op)) throw new HttpError("Unsupported query.");
  const allowed = new Set(spec.columns.split(","));
  const fields = columns === "*" ? [...allowed] : typeof columns === "string" ? columns.split(",") : [];
  if (!fields.length || fields.some((field) => !allowed.has(field))) throw new HttpError("Invalid selected fields.");
  if (!Array.isArray(filters) || filters.length > 20 || filters.some((filter) => !Array.isArray(filter) || filter.length !== 2 || !allowed.has(filter[0]) || (typeof filter[1] === "number" && !Number.isFinite(filter[1])) || (filter[1] !== null && !["string", "number", "boolean"].includes(typeof filter[1])))) throw new HttpError("Invalid filters.");
  if (filters.some(([key, value]) => value !== null && (boolColumns.has(key) ? typeof value !== "boolean" : typeof value === "boolean" && !jsonColumns.has(key)))) throw new HttpError("Invalid filters.");
  if (order && (!allowed.has(order.field) || typeof order.ascending !== "boolean")) throw new HttpError("Invalid sort.");
  if (range !== undefined && (!Array.isArray(range) || range.length !== 2 || range.some((value) => !Number.isSafeInteger(value)))) throw new HttpError("Invalid page.");
  const offset = range?.[0] ?? 0;
  const count = range ? range[1] - range[0] + 1 : 1000;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(count) || count < 1 || count > 1000) throw new HttpError("Invalid page.");
  const db = database();
  const where = filters.map(([key, value]) => value === null ? `${q(key)} IS NULL` : `${q(key)}=?`);
  const values = filters.filter(([, value]) => value !== null).map(([key, value]) => encode(key, value));
  const [policy, policyValues] = readPolicy(table, user);
  const condition = [...where, policy].join(" AND ");
  const sorting = order ? ` ORDER BY ${q(order.field)} ${order.ascending ? "ASC" : "DESC"}` : "";
  if (op === "select") {
    const rows = db.prepare(`SELECT ${fields.map(q).join(",")} FROM ${q(table)} WHERE ${condition}${sorting} LIMIT ? OFFSET ?`).all(...values, ...policyValues, count, offset).map(decode);
    return { data: single ? rows[0] || null : rows, error: null };
  }
  if (!user) throw new HttpError("Please sign in.", 401);
  if (op === "insert" || op === "upsert") {
    const input = Array.isArray(query.payload) ? query.payload : [query.payload];
    if (!input.length || input.length > 100) throw new HttpError("Invalid record count.");
    const output = transaction(db, () => input.map((payload) => {
      validateFields(table, payload);
      const row = defaults(table, payload, user);
      checkWrite(db, table, row, user, "insert");
      const previous = op === "upsert" ? db.prepare(`SELECT * FROM ${q(table)} WHERE ${spec.keys.map((key) => `${q(key)}=?`).join(" AND ")}`).get(...spec.keys.map((key) => row[key] ?? null)) : null;
      if (previous) {
        checkWrite(db, table, decode(previous), user, "update");
        checkResourceIdentity(table, previous, row);
      }
      if (table === "comments") {
        // A separate counter survives comment deletion and cannot be bypassed with old timestamps.
        try { rateLimit(`comments:${user.id}`, 5, 60); }
        catch (error) { if (error.status === 429) throw new HttpError("slow_down: Please wait one minute.", 429); throw error; }
      }
      const keys = Object.keys(row);
      const changes = keys.filter((key) => !spec.keys.includes(key));
      const conflict = op === "upsert" ? ` ON CONFLICT(${spec.keys.map(q).join(",")}) DO ${changes.length ? `UPDATE SET ${changes.map((key) => `${q(key)}=excluded.${q(key)}`).join(",")}` : "NOTHING"}` : "";
      db.prepare(`INSERT INTO ${q(table)} (${keys.map(q).join(",")}) VALUES (${keys.map(() => "?").join(",")})${conflict}`).run(...keys.map((key) => encode(key, row[key])));
      return row;
    }));
    return { data: single ? output[0] : output, error: null };
  }
  if (!filters.length) throw new HttpError("Choose a record before modifying data.");
  if (op === "update") validateFields(table, query.payload);
  // Evaluate both old and new ownership inside the write transaction. Client filters cannot bypass it.
  const output = transaction(db, () => {
    const rows = db.prepare(`SELECT * FROM ${q(table)} WHERE ${where.join(" AND ")} LIMIT 1001`).all(...values).map(decode);
    if (rows.length > 1000) throw new HttpError("Modify fewer records at once.");
    for (const old of rows) {
      checkWrite(db, table, old, user, op);
      const identity = spec.keys.map((key) => `${q(key)}=?`).join(" AND ");
      const ids = spec.keys.map((key) => old[key]);
      if (op === "delete") {
        removeDependents(db, table, old);
        db.prepare(`DELETE FROM ${q(table)} WHERE ${identity}`).run(...ids);
      }
      else {
        const row = { ...old, ...query.payload };
        checkWrite(db, table, row, user, op);
        checkResourceIdentity(table, old, row);
        const keys = Object.keys(query.payload);
        if (!keys.length) throw new HttpError("No changes supplied.");
        db.prepare(`UPDATE ${q(table)} SET ${keys.map((key) => `${q(key)}=?`).join(",")} WHERE ${identity}`).run(...keys.map((key) => encode(key, row[key])), ...ids);
      }
    }
    return rows;
  });
  return { data: single ? output[0] || null : output, error: null };
}
