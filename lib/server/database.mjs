import * as sqlite from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { courses } from "../../data/courses.js";
import { requireLocalBackend } from "../backend-config.js";

const connections = new Map();
export function dataDirectory() {
  return resolve(process.env.DATA_DIR || join(process.cwd(), ".data"));
}
export function database() {
  requireLocalBackend();
  const directory = dataDirectory();
  if (connections.has(directory)) return connections.get(directory);
  mkdirSync(directory, { recursive: true });
  // DatabaseSync is the Node 24 name; newer Node releases also expose Database.
  const Database = sqlite.Database || sqlite.DatabaseSync;
  const db = new Database(join(directory, "artificialmana.sqlite"));
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','teacher','admin')));
    CREATE TABLE IF NOT EXISTS courses (slug TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, category TEXT, published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS lessons (id TEXT PRIMARY KEY, course_slug TEXT NOT NULL REFERENCES courses(slug) ON DELETE CASCADE ON UPDATE CASCADE, position INTEGER NOT NULL DEFAULT 1, title TEXT NOT NULL, youtube_id TEXT NOT NULL, pdf_url TEXT, quiz TEXT);
    CREATE TABLE IF NOT EXISTS progress (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_slug TEXT NOT NULL, lesson_id TEXT NOT NULL, completed_at TEXT NOT NULL, PRIMARY KEY(user_id,course_slug,lesson_id));
    CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_slug TEXT NOT NULL, lesson_id TEXT NOT NULL, seconds INTEGER NOT NULL DEFAULT 0 CHECK(seconds >= 0), content TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS course_state (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_slug TEXT NOT NULL, bookmarked INTEGER NOT NULL DEFAULT 0 CHECK(bookmarked IN (0,1)), last_lesson TEXT, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,course_slug));
    CREATE TABLE IF NOT EXISTS quiz_results (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_slug TEXT NOT NULL, lesson_id TEXT NOT NULL, score INTEGER NOT NULL CHECK(score >= 0), total INTEGER NOT NULL CHECK(total > 0 AND score <= total), updated_at TEXT NOT NULL, PRIMARY KEY(user_id,course_slug,lesson_id));
    CREATE TABLE IF NOT EXISTS boards (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_slug TEXT NOT NULL, lesson_id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,course_slug,lesson_id));
    CREATE TABLE IF NOT EXISTS lesson_boards (course_slug TEXT NOT NULL, lesson_id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(course_slug,lesson_id));
    CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_slug TEXT NOT NULL, lesson_id TEXT NOT NULL, parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE, author_name TEXT NOT NULL CHECK(length(author_name) BETWEEN 1 AND 40), author_is_teacher INTEGER NOT NULL DEFAULT 0, body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1000), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS creator_materials (id TEXT PRIMARY KEY, creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_slug TEXT NOT NULL REFERENCES courses(slug) ON DELETE CASCADE ON UPDATE CASCADE, lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL, kind TEXT NOT NULL CHECK(kind IN ('link','assignment','note','file','other')), title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160), content TEXT, url TEXT, file_url TEXT, storage_path TEXT, published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS notes_owner ON notes(user_id,course_slug,lesson_id);
    CREATE INDEX IF NOT EXISTS comments_lesson ON comments(course_slug,lesson_id);
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  // Seed exactly once, not whenever the operator deliberately deletes all courses.
  if (!db.prepare("SELECT 1 FROM app_settings WHERE key='seeded'").get()) {
    transaction(db, () => {
      const now = new Date().toISOString();
      for (const course of courses) {
        db.prepare("INSERT OR IGNORE INTO courses VALUES (?,?,?,?,?,?)").run(course.slug, course.title, course.description || "", course.category || null, 1, now);
        for (const [position, lesson] of course.lessons.entries()) {
          db.prepare("INSERT OR IGNORE INTO lessons VALUES (?,?,?,?,?,?,?)").run(lesson.id, course.slug, position + 1, lesson.title, lesson.youtubeId, lesson.pdf || null, lesson.quiz ? JSON.stringify(lesson.quiz) : null);
        }
      }
      db.prepare("INSERT INTO app_settings VALUES ('seeded','1')").run();
    });
  }
  connections.set(directory, db);
  return db;
}
export function transaction(db, run) {
  db.exec("BEGIN IMMEDIATE");
  try { const result = run(); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
export function closeDatabases() {
  for (const db of connections.values()) db.close();
  connections.clear();
}
