import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Notes from "../app/course/[slug]/Notes";

// jsdom has no layout API; ProseMirror needs these to position its selection.
const geometry = { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 };
beforeAll(() => {
  document.elementFromPoint = () => document.body;
  Range.prototype.getBoundingClientRect = () => geometry;
  Range.prototype.getClientRects = () => [];
});
afterAll(() => {
  delete document.elementFromPoint;
  delete Range.prototype.getBoundingClientRect;
  delete Range.prototype.getClientRects;
});

describe("note persistence failures", () => {
  it("preserves the draft after a rejected save and clears it only after a successful retry", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    render(<Notes notes={[]} onAdd={onAdd} onDelete={vi.fn()} onExport={vi.fn()} onSeek={vi.fn()} getTime={() => 5} loggedIn />);
    const editor = await screen.findByLabelText("Write a note for this lesson");
    await user.click(editor);
    await user.type(editor, "Keep this draft");
    await user.click(screen.getByRole("button", { name: "Save note at 0:05" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your draft is still here");
    expect(editor).toHaveTextContent("Keep this draft");
    await user.click(screen.getByRole("button", { name: "Save note at 0:05" }));
    await waitFor(() => expect(editor).not.toHaveTextContent("Keep this draft"));
    expect(onAdd).toHaveBeenCalledTimes(2);
  });
  it("reports failed deletion without removing the visible note", async () => {
    const user = userEvent.setup();
    render(<Notes notes={[{ id: "n1", seconds: 0, content: "Saved note" }]} onAdd={vi.fn()} onDelete={vi.fn().mockRejectedValue(new Error("offline"))} onExport={vi.fn()} onSeek={vi.fn()} getTime={() => 0} loggedIn />);
    await user.click(screen.getByRole("button", { name: "Delete note" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not delete");
    expect(screen.getByText("Saved note")).toBeInTheDocument();
  });
});
