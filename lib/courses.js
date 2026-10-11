import { createClient } from "@supabase/supabase-js";
import { courses as sample } from "../data/courses";
import { isValidSupabaseConfig } from "./supabase-config";

// Server code. It reads published courses from Supabase.
// If Supabase is not set, or has no courses yet, it uses data/courses.js.
export async function getCourses() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!isValidSupabaseConfig(url, key)) return sample;
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const [c, l] = await Promise.all([
      sb.from("courses").select("*").eq("published", true).order("created_at"),
      sb.from("lessons").select("*").order("position"),
    ]);
    if (c.error || l.error || !c.data) {
      console.error("Could not load published courses from Supabase; showing sample courses.");
      return sample;
    }
    const list = c.data.map((row) => {
      const sampleCourse = sample.find((course) => course.slug === row.slug);
      return {
        slug: row.slug,
        title: row.title,
        description: row.description || "",
        category: row.category || undefined,
        lessons: l.data.filter((x) => x.course_slug === row.slug).map((x) => {
          const sampleLesson = sampleCourse?.lessons.find((lesson) => lesson.title === x.title);
          let quiz = x.quiz && x.quiz.length ? x.quiz : undefined;
          if (quiz && sampleLesson?.quiz) {
            const existingQuestions = new Set(quiz.map((question) => question.q));
            quiz = [
              ...quiz,
              ...sampleLesson.quiz.filter((question) => !existingQuestions.has(question.q)),
            ];
          }
          return {
            id: x.id,
            title: x.title,
            youtubeId: x.youtube_id,
            pdf: x.pdf_url || undefined,
            quiz,
          };
        }),
      };
    }).filter((c2) => c2.lessons.length > 0);
    return list.length ? list : sample;
  } catch {
    console.error("Could not load published courses from Supabase; showing sample courses.");
    return sample;
  }
}
