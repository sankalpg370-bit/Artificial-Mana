import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CourseBrowser from "../app/CourseBrowser";

const courses = [
  { slug: "a", title: "Neural Networks", description: "Deep ideas", category: "Deep Learning", lessons: [{ id: "1", title: "Backprop" }] },
  { slug: "b", title: "Prompt Basics", description: "Talk to models", category: "Prompting", lessons: [{ id: "2", title: "Few-shot" }] },
];

describe("CourseBrowser", () => {
  it("searches titles, descriptions and lesson titles", async () => {
    const u = userEvent.setup();
    render(<CourseBrowser courses={courses} />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    await u.type(screen.getByLabelText("Search courses and lessons"), "backprop");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("Neural Networks")).toBeInTheDocument();
  });
  it("filters by category and shows a message when nothing matches", async () => {
    const u = userEvent.setup();
    render(<CourseBrowser courses={courses} />);
    await u.click(screen.getByRole("button", { name: "Prompting" }));
    expect(screen.getAllByRole("link")).toHaveLength(1);
    await u.type(screen.getByLabelText("Search courses and lessons"), "zzzz");
    expect(screen.getByText(/No course found/)).toBeInTheDocument();
  });
});
