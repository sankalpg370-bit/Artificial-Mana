import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { makeFake, state } from "./fake-backend.js";

vi.mock("../lib/backend", async () => {
  const { state } = await import("./fake-backend.js");
  return { get backend() { return state.current; } };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
import Admin from "../app/admin/page";
import AuthButton from "../app/AuthButton";

afterEach(() => {
  state.current = null;
  vi.restoreAllMocks();
});

describe("Admin access", () => {
  it("does not show creator controls to a regular user", async () => {
    state.current = makeFake({
      user: { id: "student-1" },
      rows: { profiles: [{ user_id: "student-1", role: "student" }] },
    });

    render(<Admin />);

    expect(await screen.findByText("This page is for teachers only.")).toBeInTheDocument();
    expect(screen.queryByText("New course")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Creator Studio" })).not.toBeInTheDocument();
    expect(screen.queryByText("Full site control")).not.toBeInTheDocument();
  });

  it("keeps management access out of regular site navigation", async () => {
    state.current = makeFake({
      user: { id: "teacher-1", email: "teacher@example.com" },
      rows: { profiles: [{ user_id: "teacher-1", role: "teacher" }] },
    });

    render(<AuthButton />);

    expect(await screen.findByText("teacher@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Management system" })).not.toBeInTheDocument();
  });

  it("shows a helpful message when sign-out fails", async () => {
    state.current = makeFake({
      user: { id: "teacher-1", email: "teacher@example.com" },
    });
    state.current.auth.signOut = vi.fn().mockResolvedValue({ error: new Error("offline") });
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<AuthButton />);
    fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Could not log out. Please try again.");
  });

  it("shows full data controls only to an admin", async () => {
    state.current = makeFake({
      user: { id: "admin-1" },
      rows: {
        profiles: [{ user_id: "admin-1", role: "admin" }],
        notes: [{ id: "note-1", user_id: "student-1", content: "Private study note" }],
      },
    });

    render(<Admin />);

    expect(await screen.findByText("Full site control")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Private notes" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Users & roles" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Private notes" }));
    expect(await screen.findByText("id: note-1")).toBeInTheDocument();
  });

  it("saves a pasted YouTube URL as the lesson video ID", async () => {
    state.current = makeFake({
      user: { id: "teacher-1" },
      rows: {
        profiles: [{ user_id: "teacher-1", role: "teacher" }],
        courses: [{ slug: "test-course", title: "Test course", published: false }],
      },
    });

    render(<Admin />);

    fireEvent.change(await screen.findByPlaceholderText("Lesson title"), {
      target: { value: "Test lesson" },
    });
    fireEvent.change(screen.getByPlaceholderText("Paste a YouTube link or video ID"), {
      target: { value: "https://youtu.be/aircAruvnKk?si=shared" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add lesson", exact: true }));

    await screen.findByText("Lesson added.");
    expect(state.current.db.lessons[0]).toMatchObject({
      title: "Test lesson",
      youtube_id: "aircAruvnKk",
    });
  });
});
