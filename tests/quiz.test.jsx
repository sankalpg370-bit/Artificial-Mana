import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeFake, state } from "./fake-supabase.js";

vi.mock("../lib/supabase", async () => {
  const { state } = await import("./fake-supabase.js");
  return { get supabase() { return state.current; } };
});
import Quiz from "../app/course/[slug]/Quiz";

const quiz = [
  { q: "Q one?", options: ["right", "wrong"], answer: 0 },
  { q: "Q two?", options: ["wrong", "right"], answer: 1 },
];

describe("Quiz", () => {
  it("needs every answer before Check is on, then shows the score", async () => {
    const u = userEvent.setup();
    render(<Quiz quiz={quiz} slug="c" lessonId="l1" user={null} />);
    const check = screen.getByRole("button", { name: "Check answers" });
    expect(check).toBeDisabled();
    await u.click(screen.getAllByLabelText("right")[0]);
    expect(check).toBeDisabled();
    await u.click(screen.getAllByLabelText("wrong")[1]); // the wrong answer for Q two
    await u.click(check);
    expect(screen.getByText("You got 1 of 2.")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("quiz:c:l1"))).toEqual({ score: 1, total: 2 });
  });
  it("keeps the best score and calls onResult", async () => {
    const u = userEvent.setup();
    localStorage.setItem("quiz:c:l1", JSON.stringify({ score: 2, total: 2 }));
    const onResult = vi.fn();
    render(<Quiz quiz={quiz} slug="c" lessonId="l1" user={null} onResult={onResult} />);
    expect(await screen.findByText("Your best score: 2 of 2")).toBeInTheDocument();
    await u.click(screen.getAllByLabelText("wrong")[0]);
    await u.click(screen.getAllByLabelText("wrong")[1].closest("label").querySelector("input"));
    await u.click(screen.getByRole("button", { name: "Check answers" }));
    expect(JSON.parse(localStorage.getItem("quiz:c:l1")).score).toBe(2); // not lowered
  });
  it("shows questions in batches of ten and saves the expanded quiz score", async () => {
    const u = userEvent.setup();
    const extendedQuiz = Array.from({ length: 12 }, (_, i) => ({
      q: `Question ${i + 1}?`,
      options: ["correct", "incorrect"],
      answer: 0,
    }));
    render(<Quiz quiz={extendedQuiz} slug="c" lessonId="l1" user={null} />);

    expect(screen.getAllByRole("radio")).toHaveLength(20);
    await u.click(screen.getByRole("button", { name: "Show 2 more questions" }));
    expect(screen.getAllByRole("radio")).toHaveLength(24);

    for (const radio of screen.getAllByRole("radio").filter((_, index) => index % 2 === 0)) {
      await u.click(radio);
    }
    await u.click(screen.getByRole("button", { name: "Check answers" }));

    expect(screen.getByText("You got 12 of 12.")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("quiz:c:l1"))).toEqual({ score: 12, total: 12 });
  });
  it("saves to the account when the student is logged in", async () => {
    const u = userEvent.setup();
    const fake = makeFake({ user: { id: "u1" } });
    state.current = fake;
    const onResult = vi.fn();
    render(<Quiz quiz={quiz} slug="c" lessonId="l1" user={{ id: "u1" }} onResult={onResult} />);
    await u.click(screen.getAllByLabelText("right")[0]);
    await u.click(screen.getAllByLabelText("right")[1]);
    await u.click(screen.getByRole("button", { name: "Check answers" }));
    await vi.waitFor(() => expect(onResult).toHaveBeenCalled());
    expect(fake.db.quiz_results[0]).toMatchObject({ user_id: "u1", course_slug: "c", lesson_id: "l1", score: 2, total: 2 });
  });
});
