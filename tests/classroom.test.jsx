import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeFake, state } from "./fake-supabase.js";

vi.mock("../lib/supabase", async () => {
  const { state } = await import("./fake-supabase.js");
  return { get supabase() { return state.current; } };
});
// The notes editor and the boards have their own tests. Here we test the lesson page logic.
vi.mock("../app/course/[slug]/Notes", () => ({ default: () => null, fmt: (s) => String(s) }));
vi.mock("../app/course/[slug]/Whiteboard", () => ({ default: () => null }));
import Classroom from "../app/course/[slug]/Classroom";

const course = {
  slug: "intro", title: "Intro to AI", description: "",
  lessons: [
    { id: "l1", title: "First lesson", youtubeId: "aaaaaaaaaaa" },
    { id: "l2", title: "Second lesson", youtubeId: "bbbbbbbbbbb" },
    { id: "l3", title: "Third lesson", youtubeId: "ccccccccccc" },
  ],
};

let players;
beforeEach(() => {
  players = [];
  window.YT = {
    Player: class {
      constructor(id, opts) { this.opts = opts; this.loaded = []; players.push(this); }
      loadVideoById(v) { this.loaded.push(v); }
      getCurrentTime() { return 5; }
      destroy() {}
    },
  };
});

const endVideo = async () => { await act(async () => { players[0].opts.events.onStateChange({ data: 0 }); }); };
const lessonButton = (name) => screen.getByRole("button", { name: new RegExp(name) });

describe("Classroom", () => {
  it("starts on lesson 1 with the nocookie player", () => {
    render(<Classroom course={course} />);
    expect(lessonButton("First lesson")).toHaveAttribute("aria-current", "true");
    expect(players[0].opts.videoId).toBe("aaaaaaaaaaa");
    expect(players[0].opts.host).toBe("https://www.youtube-nocookie.com");
  });
  it("shows published course and current lesson materials", async () => {
    state.current = makeFake({ rows: { creator_materials: [
      { id: "m1", course_slug: "intro", lesson_id: null, kind: "link", title: "Course guide", published: true, url: "https://example.com" },
      { id: "m2", course_slug: "intro", lesson_id: "l1", kind: "assignment", title: "First lesson assignment", published: true },
      { id: "m3", course_slug: "intro", lesson_id: "l2", kind: "note", title: "Other lesson note", published: true },
      { id: "m4", course_slug: "intro", lesson_id: "l1", kind: "note", title: "Unpublished note", published: false },
    ] } });

    render(<Classroom course={course} />);

    expect(await screen.findByText("Course guide")).toBeInTheDocument();
    expect(screen.getByText("First lesson assignment")).toBeInTheDocument();
    expect(screen.queryByText("Other lesson note")).not.toBeInTheDocument();
    expect(screen.queryByText("Unpublished note")).not.toBeInTheDocument();
  });
  it("marks a lesson done when the video ends and plays the next one (Play All)", async () => {
    render(<Classroom course={course} />);
    await endVideo();
    expect(JSON.parse(localStorage.getItem("progress:intro"))).toEqual(["l1"]);
    await waitFor(() => expect(lessonButton("Second lesson")).toHaveAttribute("aria-current", "true"));
    expect(screen.getByText(/1 of 3 lessons done/)).toBeInTheDocument();
    expect(players[0].loaded).toContain("bbbbbbbbbbb");
  });
  it("does not move on when Play All is off", async () => {
    const u = userEvent.setup();
    render(<Classroom course={course} />);
    await u.click(screen.getByRole("checkbox"));
    await endVideo();
    expect(JSON.parse(localStorage.getItem("progress:intro"))).toEqual(["l1"]);
    expect(lessonButton("First lesson")).toHaveAttribute("aria-current", "true");
  });
  it("opens the last lesson the student watched", async () => {
    localStorage.setItem("state:intro", JSON.stringify({ bookmarked: false, last: "l3" }));
    render(<Classroom course={course} />);
    await waitFor(() => expect(lessonButton("Third lesson")).toHaveAttribute("aria-current", "true"));
  });
  it("remembers the lesson when the student picks one", async () => {
    const u = userEvent.setup();
    render(<Classroom course={course} />);
    await u.click(lessonButton("Second lesson"));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("state:intro")).last).toBe("l2"));
  });
  it("saves and removes the bookmark", async () => {
    const u = userEvent.setup();
    render(<Classroom course={course} />);
    await u.click(screen.getByRole("button", { name: /Save course/ }));
    expect(screen.getByRole("button", { name: /Saved/ })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("state:intro")).bookmarked).toBe(true);
    await u.click(screen.getByRole("button", { name: /Saved/ }));
    expect(JSON.parse(localStorage.getItem("state:intro")).bookmarked).toBe(false);
  });
  it("keeps browser-only progress separate from the signed-in account", async () => {
    localStorage.setItem("progress:intro", JSON.stringify(["l1", "l2", "gone"]));
    const fake = makeFake({ user: { id: "u1" }, rows: { progress: [{ user_id: "u1", course_slug: "intro", lesson_id: "l2" }] } });
    state.current = fake;
    render(<Classroom course={course} />);
    expect(await screen.findByText(/1 of 3 lessons done/)).toBeInTheDocument();
    expect(fake.db.progress.map((r) => r.lesson_id)).toEqual(["l2"]);
    expect(JSON.parse(localStorage.getItem("progress:intro"))).toEqual(["l1", "l2", "gone"]);
  });
  it("shows the certificate only after all lessons are done", async () => {
    localStorage.setItem("progress:intro", JSON.stringify(["l1", "l2", "l3"]));
    render(<Classroom course={course} />);
    expect(await screen.findByText(/You finished this course/)).toBeInTheDocument();
  });
  it("needs a passed quiz for the certificate", async () => {
    const withQuiz = { ...course, lessons: [{ ...course.lessons[0], quiz: [{ q: "?", options: ["a", "b"], answer: 0 }] }] };
    localStorage.setItem("progress:intro", JSON.stringify(["l1"]));
    const { unmount } = render(<Classroom course={withQuiz} />);
    expect(screen.getByText(/Finish all lessons and pass every quiz/)).toBeInTheDocument();
    unmount();
    localStorage.setItem("quiz:intro:l1", JSON.stringify({ score: 1, total: 1 }));
    render(<Classroom course={withQuiz} />);
    expect(await screen.findByText(/You finished this course/)).toBeInTheDocument();
  });
});
