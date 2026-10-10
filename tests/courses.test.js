import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFake, state } from "./fake-supabase.js";

vi.mock("@supabase/supabase-js", async () => {
  const { state } = await import("./fake-supabase.js");
  return { createClient: () => state.current };
});
import { getCourses } from "../lib/courses";
import { courses as sample } from "../data/courses";

describe("getCourses", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "key";
  });
  it("uses the sample course when Supabase is not set", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(await getCourses()).toBe(sample);
  });
  it("uses the sample course when no course is published", async () => {
    state.current = makeFake({ rows: { courses: [], lessons: [] } });
    expect(await getCourses()).toBe(sample);
  });
  it("maps database rows, sorts lessons, and hides courses with no lessons", async () => {
    state.current = makeFake({ rows: {
      courses: [
        { slug: "a", title: "A", description: "d", category: "Basics", published: true, created_at: "1" },
        { slug: "b", title: "B", description: "", category: null, published: true, created_at: "2" },
        { slug: "c", title: "C", published: false, created_at: "3" },
      ],
      lessons: [
        { id: "l2", course_slug: "a", position: 2, title: "Two", youtube_id: "bbbbbbbbbbb", pdf_url: null, quiz: null },
        { id: "l1", course_slug: "a", position: 1, title: "One", youtube_id: "aaaaaaaaaaa", pdf_url: "/x.pdf", quiz: [{ q: "?", options: ["a", "b"], answer: 0 }] },
      ],
    } });
    const list = await getCourses();
    expect(list.map((c) => c.slug)).toEqual(["a"]);
    expect(list[0].lessons.map((l) => l.id)).toEqual(["l1", "l2"]);
    expect(list[0].lessons[0]).toMatchObject({ youtubeId: "aaaaaaaaaaa", pdf: "/x.pdf" });
    expect(list[0].lessons[1].quiz).toBeUndefined();
    expect(list[0].category).toBe("Basics");
  });
});
