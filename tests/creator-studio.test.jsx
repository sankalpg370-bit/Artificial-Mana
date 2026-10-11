import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeFake, state } from "./fake-backend.js";

vi.mock("../lib/backend", async () => {
  const { state } = await import("./fake-backend.js");
  return { get backend() { return state.current; } };
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


it("keeps a newly linked upload when removal of the old file throws", async () => {
  const user = userEvent.setup();
  const fake = makeFake({ user: { id: "teacher-1" }, rows: {
    profiles: [{ user_id: "teacher-1", role: "teacher" }],
    courses: [{ slug: "intro", title: "Introduction to AI" }],
    creator_materials: [{ id: "m1", creator_id: "teacher-1", course_slug: "intro", kind: "file", title: "Worksheet", storage_path: "teacher-1/old.pdf", published: false }],
  } });
  const remove = vi.fn().mockRejectedValue(new Error("storage offline"));
  fake.storage = { from: () => ({
    createSignedUrl: async () => ({ data: { signedUrl: "https://example.com/old.pdf" } }),
    upload: async () => ({ error: null }),
    remove,
  }) };
  state.current = fake;
  render(<CreatorStudio />);
  await screen.findByRole("heading", { name: "Worksheet" });
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.upload(screen.getByLabelText(/Attach a file/), new File(["pdf"], "new.pdf", { type: "application/pdf" }));
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByText(/Material saved, but file cleanup failed/)).toBeInTheDocument();
  expect(fake.db.creator_materials[0].storage_path).toMatch(/new.pdf$/);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith(["teacher-1/old.pdf"]);
});
