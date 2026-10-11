import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { makeFake, state } from "./fake-supabase.js";

vi.mock("../lib/supabase", async () => {
  const { state } = await import("./fake-supabase.js");
  return { get supabase() { return state.current; } };
});
import Admin from "../app/admin/page";

afterEach(() => {
  state.current = null;
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
});
