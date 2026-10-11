import { describe, it, expect, vi } from "vitest";
vi.mock("../lib/server/query.mjs", () => ({ executeQuery: vi.fn(() => ({ data: [] })) }));
import { getCourses, mapCourseRows } from "../lib/courses";
import { executeQuery } from "../lib/server/query.mjs";
import { courses as sample } from "../data/courses";

describe("local course loading", () => {
  it("keeps deliberately empty catalogs empty", async () => {
    expect(await getCourses()).toEqual([]);
  });
  it("reads public data through the server permission layer", async () => {
    await getCourses();
    expect(executeQuery).toHaveBeenCalledWith({ table: "courses", order: { field: "created_at", ascending: true } });
  });
  it("maps stored courses and excludes courses without lessons", () => {
    const result = mapCourseRows([{ slug: "a", title: "A", category: "Basics" }, { slug: "b", title: "Empty" }], [{ id: "l1", course_slug: "a", title: "One", youtube_id: "aaaaaaaaaaa", pdf_url: "/x.pdf", quiz: [{ q: "?", options: ["a", "b"], answer: 0 }] }]);
    expect(result).toHaveLength(1);
    expect(result[0].lessons[0]).toMatchObject({ youtubeId: "aaaaaaaaaaa", pdf: "/x.pdf" });
  });
  it("can explicitly run the browser-only sample demo", async () => {
    const previous = process.env.NEXT_PUBLIC_LOCAL_ONLY;
    process.env.NEXT_PUBLIC_LOCAL_ONLY = "1";
    try { expect(await getCourses()).toBe(sample); }
    finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_LOCAL_ONLY; else process.env.NEXT_PUBLIC_LOCAL_ONLY = previous; }
  });
});
