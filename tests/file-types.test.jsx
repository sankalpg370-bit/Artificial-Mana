import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeFake, state } from "./fake-backend.js";

vi.mock("../lib/backend", async () => {
  const { state } = await import("./fake-backend.js");
  return { get backend() { return state.current; } };
});
import CreatorStudio from "../app/creator-studio/studio";

function setup() {
  const upload = vi.fn(async () => ({ error: null }));
  const fake = makeFake({
    user: { id: "teacher-1", email: "t@example.com" },
    rows: {
      profiles: [{ user_id: "teacher-1", role: "teacher" }],
      courses: [{ slug: "intro", title: "Introduction to AI" }],
      lessons: [],
    },
  });
  fake.storage = {
    from: () => ({
      upload,
      remove: async () => ({ error: null }),
      createSignedUrl: async () => ({ data: { signedUrl: "https://signed.example/file" }, error: null }),
    }),
  };
  state.current = fake;
  return { fake, upload };
}

async function fillAndUpload(user, container, file) {
  await screen.findByRole("option", { name: "Introduction to AI" });
  await user.selectOptions(screen.getByLabelText("Course"), "intro");
  await user.type(screen.getByLabelText("Title"), "Reading");
  await user.upload(container.querySelector('input[type="file"]'), file);
  await user.click(screen.getByRole("button", { name: "Save material" }));
}

describe("Creator uploads: file types", () => {
  it("refuses a web page file, even if the browser filter is bypassed", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { upload } = setup();
    const { container } = render(<CreatorStudio />);
    await fillAndUpload(user, container, new File(["<script>alert(1)</script>"], "page.html", { type: "text/html" }));
    expect(await screen.findByText(/file type is not allowed/i)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses an SVG image (it can contain scripts)", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { upload } = setup();
    const { container } = render(<CreatorStudio />);
    await fillAndUpload(user, container, new File(["<svg/>"], "pic.svg", { type: "image/svg+xml" }));
    expect(await screen.findByText(/file type is not allowed/i)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses a file whose declared type does not match its extension", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { upload } = setup();
    const { container } = render(<CreatorStudio />);
    await fillAndUpload(user, container, new File(["<svg/>"], "pic.png", { type: "image/svg+xml" }));
    expect(await screen.findByText(/file type is not allowed/i)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("accepts a Word file and sets its content type", async () => {
    const user = userEvent.setup();
    const { fake, upload } = setup();
    const { container } = render(<CreatorStudio />);
    await fillAndUpload(user, container, new File(["x"], "book chapter.docx", { type: "" }));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    const [path, , options] = upload.mock.calls[0];
    expect(path.startsWith("teacher-1/")).toBe(true);
    expect(path).toContain("book_chapter.docx");
    expect(options.contentType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    await waitFor(() => expect(fake.db.creator_materials).toHaveLength(1));
  });
});
