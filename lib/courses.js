import { courses as sample } from "../data/courses";
import { createClient } from "@supabase/supabase-js";
import { backendMode, hostedConfig, requireLocalBackend } from "./backend-config";

export function mapCourseRows(courseRows, lessonRows) {
  return courseRows.map((row) => ({
    slug: row.slug, title: row.title, description: row.description || "", category: row.category || undefined,
    lessons: lessonRows.filter((lesson) => lesson.course_slug === row.slug).map((lesson) => ({
      id: lesson.id, title: lesson.title, youtubeId: lesson.youtube_id,
      pdf: lesson.pdf_url || undefined, quiz: lesson.quiz?.length ? lesson.quiz : undefined,
    })),
  })).filter((course) => course.lessons.length > 0);
}

// Read the PC's SQLite database directly on the server; no external API or public credentials.
export async function getCourses() {
  if (process.env.NEXT_PUBLIC_LOCAL_ONLY === "1") return sample;
  if (backendMode() === "supabase") {
    const { url, key } = hostedConfig();
    // Anonymous read: published content only. No admin credential or account cookie.
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    async function readAll(table, field) {
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client.from(table).select("*").order(field).order(table === "courses" ? "slug" : "id").range(offset, offset + 999);
        if (error) throw new Error(`Could not load published ${table}. Check the hosted database setup.`);
        rows.push(...data);
        if (data.length < 1000) return rows;
      }
    }
    const [courses, lessons] = await Promise.all([readAll("courses", "created_at"), readAll("lessons", "position")]);
    return mapCourseRows(courses, lessons);
  }
  requireLocalBackend();
  const { executeQuery } = await import("./server/query.mjs");
  const courses = executeQuery({ table: "courses", order: { field: "created_at", ascending: true } }).data;
  const lessons = executeQuery({ table: "lessons", order: { field: "position", ascending: true } }).data;
  return mapCourseRows(courses, lessons);
}
