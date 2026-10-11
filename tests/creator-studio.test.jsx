import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeFake, state } from "./fake-supabase.js";

vi.mock("../lib/supabase", async () => {
  const { state } = await import("./fake-supabase.js");
  return { get supabase() { return state.current; } };
});
import CreatorStudio from "../app/creator-studio/studio";

describe("CreatorStudio", () => {
  it("lets a signed-in teacher add a course resource for learners", async () => {
    const user = userEvent.setup();
    const fake = makeFake({
      user: { id: "teacher-1", email: "teacher@example.com" },
      rows: {
        profiles: [{ user_id: "teacher-1", role: "teacher" }],
        courses: [{ slug: "intro", title: "Introduction to AI" }],
        lessons: [{ id: "lesson-1", course_slug: "intro", title: "First lesson" }],
      },
    });
    state.current = fake;

    render(<CreatorStudio />);

    await screen.findByRole("option", { name: "Introduction to AI" });
    await user.selectOptions(screen.getByLabelText("Course"), "intro");
    await user.type(screen.getByLabelText("Title"), "Homework");
    await user.type(screen.getByLabelText("Description or assignment instructions"), "Complete the worksheet.");
    await user.click(screen.getByLabelText("Visible to learners"));
    await user.click(screen.getByRole("button", { name: "Save material" }));

    await waitFor(() => expect(fake.db.creator_materials).toHaveLength(1));
    expect(fake.db.creator_materials[0]).toMatchObject({
      creator_id: "teacher-1",
      course_slug: "intro",
      title: "Homework",
      content: "Complete the worksheet.",
      published: true,
    });
    expect(await screen.findByText("Material saved.")).toBeInTheDocument();
  });

  it("does not show creator controls to a signed-in student", async () => {
    state.current = makeFake({
      user: { id: "student-1" },
      rows: { profiles: [{ user_id: "student-1", role: "student" }] },
    });

    render(<CreatorStudio />);

    expect(await screen.findByRole("alert")).toHaveTextContent("only available to teacher and admin accounts");
    expect(screen.queryByRole("button", { name: "Save material" })).not.toBeInTheDocument();
  });

  it("loads only materials owned by the signed-in creator", async () => {
    const fake = makeFake({
      user: { id: "teacher-1", email: "teacher@example.com" },
      rows: {
        profiles: [{ user_id: "teacher-1", role: "teacher" }],
        courses: [{ slug: "intro", title: "Introduction to AI" }],
        creator_materials: [
          { creator_id: "teacher-1", course_slug: "intro", kind: "note", title: "My material", published: false },
          { creator_id: "teacher-2", course_slug: "intro", kind: "note", title: "Other creator material", published: false },
        ],
      },
    });
    state.current = fake;

    render(<CreatorStudio />);

    expect(await screen.findByRole("heading", { name: "My material" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Other creator material" })).not.toBeInTheDocument();
    const query = fake.log.find((entry) => entry.table === "creator_materials" && entry.op === "select");
    expect(query.filters).toContainEqual(["creator_id", "teacher-1"]);
  });
});
