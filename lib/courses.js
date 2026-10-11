import { courses as sample } from "../data/courses";
import { executeQuery } from "./server/query.mjs";

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
  const courses = executeQuery({ table: "courses", order: { field: "created_at", ascending: true } }).data;
  const lessons = executeQuery({ table: "lessons", order: { field: "position", ascending: true } }).data;
  return mapCourseRows(courses, lessons);
}
