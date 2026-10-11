import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeFake, state } from "./fake-backend.js";

vi.mock("../lib/backend", async () => {
  const { state } = await import("./fake-backend.js");
  return { get backend() { return state.current; } };
});
import Comments from "../app/course/[slug]/Comments";

const seed = {
  comments: [
    { id: "c1", user_id: "u1", course_slug: "c", lesson_id: "l1", parent_id: null, author_name: "Mine", author_is_teacher: false, body: "my question", created_at: "2026-01-01T10:00:00Z" },
    { id: "c2", user_id: "u2", course_slug: "c", lesson_id: "l1", parent_id: null, author_name: "Other", author_is_teacher: false, body: "<b>other</b> comment", created_at: "2026-01-01T11:00:00Z" },
    { id: "c3", user_id: "t1", course_slug: "c", lesson_id: "l1", parent_id: "c1", author_name: "Prof", author_is_teacher: true, body: "an answer", created_at: "2026-01-01T12:00:00Z" },
  ],
};

describe("Comments", () => {
  it("asks visitors to log in and does not show the form", async () => {
    state.current = makeFake({ rows: seed });
    render(<Comments slug="c" lessonId="l1" user={null} teacher={false} />);
    expect(await screen.findByText("my question")).toBeInTheDocument();
    expect(screen.getByText(/to ask a question or write a comment/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Post" })).toBeNull();
  });
  it("shows text as plain text, a Teacher badge, and the reply under its parent", async () => {
    state.current = makeFake({ rows: seed });
    const { container } = render(<Comments slug="c" lessonId="l1" user={null} teacher={false} />);
    expect(await screen.findByText("<b>other</b> comment")).toBeInTheDocument(); // not turned into bold
    expect(container.querySelector(".cm p b")).toBeNull();
    expect(screen.getByText("Teacher")).toBeInTheDocument();
    expect(container.querySelectorAll(".reply")).toHaveLength(1);
  });
  it("a student can delete only their own comment; a teacher can delete all", async () => {
    state.current = makeFake({ user: { id: "u1" }, rows: seed });
    const { unmount } = render(<Comments slug="c" lessonId="l1" user={{ id: "u1" }} teacher={false} />);
    await screen.findByText("my question");
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);
    unmount();
    state.current = makeFake({ user: { id: "t1" }, rows: seed });
    render(<Comments slug="c" lessonId="l1" user={{ id: "t1" }} teacher={true} />);
    await screen.findByText("my question");
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(3);
  });
  it("posts a comment and remembers the name", async () => {
    const u = userEvent.setup();
    const fake = makeFake({ user: { id: "u1" }, rows: { comments: [] } });
    state.current = fake;
    render(<Comments slug="c" lessonId="l1" user={{ id: "u1" }} teacher={false} />);
    await u.type(screen.getByLabelText("Your name"), "Ada");
    await u.type(screen.getByLabelText("Your comment"), "Hello there");
    await u.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByText("Hello there")).toBeInTheDocument();
    expect(fake.db.comments[0]).toMatchObject({ author_name: "Ada", body: "Hello there", course_slug: "c", lesson_id: "l1" });
    expect(localStorage.getItem("comment-name")).toBe("Ada");
  });
  it("asks for a name first and explains the spam limit", async () => {
    const u = userEvent.setup();
    state.current = makeFake({ user: { id: "u1" }, rows: { comments: [] }, failInsert: "slow_down" });
    render(<Comments slug="c" lessonId="l1" user={{ id: "u1" }} teacher={false} />);
    await u.type(screen.getByLabelText("Your comment"), "x");
    await u.click(screen.getByRole("button", { name: "Post" }));
    expect(screen.getByText("Write your name first.")).toBeInTheDocument();
    await u.type(screen.getByLabelText("Your name"), "Ada");
    await u.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByText(/wait one minute/)).toBeInTheDocument();
  });
});
