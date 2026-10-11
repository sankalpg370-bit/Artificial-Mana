// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { database, closeDatabases } from "../lib/server/database.mjs";
import { createUser, passwordMatches, issueSession, sessionUser, revokeSession, sessionCookie, rateLimit } from "../lib/server/auth.mjs";
import { executeQuery } from "../lib/server/query.mjs";
import { uploadFile, downloadFile, removeFile, fileLocation } from "../lib/server/uploads.mjs";
import { requireSameOrigin, readJson } from "../lib/server/http.mjs";

let directory;
const originalDirectory = process.env.DATA_DIR;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "mana-test-")); process.env.DATA_DIR = directory; });
afterEach(async () => {
  closeDatabases();
  if (originalDirectory === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = originalDirectory;
  await rm(directory, { recursive: true, force: true });
});
const insert = (table, payload, user) => executeQuery({ table, op: "insert", payload, single: true }, user).data;
const read = (table, user, filters = []) => executeQuery({ table, filters }, user).data;
async function student(email = "student@example.com") { return { ...await createUser(email, "VerySecurePassword123"), role: "student" }; }
async function admin() { return { ...await createUser("admin@example.com", "VerySecurePassword123", "admin"), role: "admin" }; }

describe("home PC backend permissions and persistence", () => {
  it("stores salted password hashes, validates passwords, and revokes opaque sessions", async () => {
    const user = await student();
    const stored = database().prepare("SELECT password_hash FROM users WHERE id=?").get(user.id).password_hash;
    expect(stored).not.toContain("VerySecurePassword123");
    expect(await passwordMatches("VerySecurePassword123", stored)).toBe(true);
    expect(await passwordMatches("WrongPassword123", stored)).toBe(false);
    const token = issueSession(user);
    const request = new Request("http://localhost/api/account", { headers: { cookie: `am-session=${token}` } });
    expect(sessionUser(request).id).toBe(user.id);
    revokeSession(request);
    expect(sessionUser(request)).toBeNull();
    expect(sessionCookie(token, request)).toContain("HttpOnly");
  });
  it("blocks cross-account reads, forged ownership and role escalation", async () => {
    const owner = await student();
    const other = await student("other@example.com");
    const note = insert("notes", { course_slug: "intro-to-ai", lesson_id: "l1", content: "Private" }, owner);
    expect(read("notes", other)).toEqual([]);
    expect(() => insert("notes", { user_id: owner.id, course_slug: "intro-to-ai", lesson_id: "l1", content: "Forged" }, other)).toThrow(/another account/);
    expect(() => executeQuery({ table: "notes", op: "delete", filters: [["id", note.id]] }, other)).toThrow(/another account/);
    expect(() => executeQuery({ table: "profiles", op: "update", payload: { role: "admin" }, filters: [["user_id", other.id]] }, other)).toThrow(/Only admins/);
    expect(read("notes", owner)[0].content).toBe("Private");
  });
  it("hides drafts and permits admin oversight", async () => {
    const manager = await admin();
    const learner = await student();
    insert("courses", { slug: "private-course", title: "Draft" }, manager);
    expect(read("courses", null).some((course) => course.slug === "private-course")).toBe(false);
    insert("notes", { course_slug: "intro-to-ai", lesson_id: "l1", content: "Help me" }, learner);
    expect(read("notes", manager)).toHaveLength(1);
    expect(() => insert("courses", { slug: "forged-course", title: "Forged" }, learner)).toThrow(/Teacher/);
  });
  it("upserts board JSON and keeps stored data after reopening the database", async () => {
    const user = await student();
    const query = { table: "boards", op: "upsert", payload: { user_id: user.id, course_slug: "intro-to-ai", lesson_id: "l1", data: { strokes: ["first"] } } };
    executeQuery(query, user);
    executeQuery({ ...query, payload: { ...query.payload, data: { strokes: ["latest"] } } }, user);
    closeDatabases();
    expect(read("boards", user)).toHaveLength(1);
    expect(read("boards", user)[0].data).toEqual({ strokes: ["latest"] });
  });
  it("rejects unsafe fields, executable URLs and unbounded changes", async () => {
    const user = await admin();
    expect(() => read("users", user)).toThrow(/Unsupported/);
    expect(() => insert("courses", { slug: "unsafe", title: "X", password_hash: "x" }, user)).toThrow(/Unknown field/);
    expect(() => insert("creator_materials", { course_slug: "intro-to-ai", kind: "link", title: "X", url: "javascript:alert(1)" }, user)).toThrow(/HTTP/);
    expect(() => executeQuery({ table: "courses", op: "delete" }, user)).toThrow(/Choose a record/);
  });
  it("derives comment attribution and enforces the per-account spam limit", async () => {
    const user = await student();
    const row = { course_slug: "intro-to-ai", lesson_id: "l1", author_name: "Ada", body: "Question", author_is_teacher: true };
    expect(insert("comments", row, user).author_is_teacher).toBe(false);
    for (let i = 0; i < 4; i++) insert("comments", row, user);
    expect(() => insert("comments", row, user)).toThrow(/slow_down/);
  });
  it("does not let forged timestamps or deleting comments reset the spam limit", async () => {
    const user = await student();
    const row = { course_slug: "intro-to-ai", lesson_id: "l1", author_name: "Ada", body: "Question", created_at: "2000-01-01T00:00:00.000Z" };
    for (let i = 0; i < 5; i++) {
      const comment = insert("comments", row, user);
      expect(Date.parse(comment.created_at)).toBeGreaterThan(Date.now() - 10000);
      executeQuery({ table: "comments", op: "delete", filters: [["id", comment.id]] }, user);
    }
    expect(read("comments", user)).toEqual([]);
    expect(() => insert("comments", row, user)).toThrow(/slow_down/);
  });
  it("removes dependent course data and rejects late writes after course deletion", async () => {
    const manager = await admin();
    const user = await student();
    const linked = { course_slug: "intro-to-ai", lesson_id: "l1" };
    insert("progress", linked, user);
    insert("notes", { ...linked, content: "Private note" }, user);
    insert("quiz_results", { ...linked, score: 1, total: 1 }, user);
    insert("boards", { ...linked, lesson_id: "l1:diagram", data: { elements: [] } }, user);
    insert("lesson_boards", { ...linked, data: { strokes: [] } }, manager);
    insert("course_state", { course_slug: linked.course_slug, last_lesson: "l1", bookmarked: true }, user);
    insert("comments", { ...linked, author_name: "Ada", body: "Question" }, user);
    executeQuery({ table: "courses", op: "delete", filters: [["slug", linked.course_slug]] }, manager);
    for (const table of ["progress", "notes", "quiz_results", "boards", "lesson_boards", "course_state", "comments", "lessons"]) expect(read(table, manager)).toEqual([]);
    expect(() => insert("notes", { ...linked, content: "Late save" }, user)).toThrow(/no longer exists/);
    insert("courses", { slug: linked.course_slug, title: "Replacement course", published: true }, manager);
    expect(read("comments", user)).toEqual([]);
  });
  it("deletes lesson data including diagrams and clears resume position without losing bookmarks", async () => {
    const manager = await admin();
    const user = await student();
    const linked = { course_slug: "intro-to-ai", lesson_id: "l1" };
    insert("notes", { ...linked, content: "First lesson" }, user);
    insert("notes", { ...linked, lesson_id: "l2", content: "Other lesson" }, user);
    insert("boards", { ...linked, data: { strokes: [] } }, user);
    insert("boards", { ...linked, lesson_id: "l1:diagram", data: { elements: [] } }, user);
    insert("lesson_boards", { ...linked, data: { strokes: [] } }, manager);
    insert("course_state", { course_slug: linked.course_slug, last_lesson: "l1", bookmarked: true }, user);
    executeQuery({ table: "lessons", op: "delete", filters: [["id", "l1"]] }, manager);
    expect(read("notes", user).map((note) => note.content)).toEqual(["Other lesson"]);
    expect(read("boards", user)).toEqual([]);
    expect(read("lesson_boards", manager)).toEqual([]);
    expect(read("course_state", user)[0]).toMatchObject({ last_lesson: null, bookmarked: true });
    expect(() => insert("boards", { ...linked, lesson_id: "l1:diagram", data: {} }, user)).toThrow(/Choose a lesson/);
  });
  it("rejects malformed request envelopes and invalid scalar fields as client errors", async () => {
    const manager = await admin();
    for (const body of ["null", "[]", "true", '"text"']) {
      const request = new Request("http://localhost/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      await expect(readJson(request)).rejects.toMatchObject({ status: 400 });
    }
    for (const query of [null, [], { table: { toString: null } }, { table: "notes", filters: [["seconds", Infinity]] }, { table: "notes", filters: [["content", false]] }, { table: "notes", range: null }, { table: "notes", range: [null, null] }]) expect(() => executeQuery(query, manager)).toThrow();
    expect(() => insert("creator_materials", { course_slug: "intro-to-ai", kind: "file", title: "X", storage_path: 123 }, manager)).toThrow(/Invalid storage_path/);
    expect(() => insert("notes", { course_slug: "intro-to-ai", lesson_id: "", content: "Orphan" }, manager)).toThrow(/Choose a lesson/);
  });
  it("keeps resource identities stable while allowing title edits", async () => {
    const manager = await admin();
    const courseQuery = { table: "courses", op: "update", filters: [["slug", "intro-to-ai"]] };
    executeQuery({ ...courseQuery, payload: { title: "Renamed course" } }, manager);
    expect(read("courses", manager)[0].title).toBe("Renamed course");
    expect(() => executeQuery({ ...courseQuery, payload: { slug: "new-address" } }, manager)).toThrow(/identities cannot be changed/);
    const lessonQuery = { table: "lessons", op: "update", filters: [["id", "l1"]] };
    expect(() => executeQuery({ ...lessonQuery, payload: { id: "replacement" } }, manager)).toThrow(/identities cannot be changed/);
    insert("courses", { slug: "another-course", title: "Other course" }, manager);
    expect(() => executeQuery({ ...lessonQuery, payload: { course_slug: "another-course" } }, manager)).toThrow(/identities cannot be changed/);
    const lesson = read("lessons", manager, [["id", "l1"]])[0];
    expect(() => executeQuery({ table: "lessons", op: "upsert", payload: { ...lesson, course_slug: "another-course" } }, manager)).toThrow(/identities cannot be changed/);
  });
  it("validates uploads and grants access only to owners or published material readers", async () => {
    const creator = await admin();
    const path = [creator.id, "worksheet.txt"];
    await uploadFile(new Request("http://localhost/upload", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "Lesson worksheet" }), "creator-materials", path, creator);
    await expect(downloadFile("creator-materials", path, null)).rejects.toThrow(/unavailable/);
    insert("creator_materials", { creator_id: creator.id, course_slug: "intro-to-ai", kind: "file", title: "Worksheet", storage_path: path.join("/"), published: true }, creator);
    expect((await downloadFile("creator-materials", path, null)).bytes.toString()).toBe("Lesson worksheet");
    await removeFile("creator-materials", path, creator);
    await expect(downloadFile("creator-materials", path, creator)).rejects.toThrow(/not found/);
    expect(() => fileLocation("creator-materials", ["..", "secret.txt"])).toThrow(/Invalid file/);
  });
  it("requires matching mutation origins and rate-limits repeated requests", () => {
    expect(() => requireSameOrigin(new Request("http://localhost/api/data", { headers: { origin: "https://attacker.example" } }))).toThrow(/not allowed/);
    requireSameOrigin(new Request("http://localhost/api/data", { headers: { origin: "http://localhost" } }));
    rateLimit("test", 1, 60);
    expect(() => rateLimit("test", 1, 60)).toThrow(/Too many/);
  });
});
