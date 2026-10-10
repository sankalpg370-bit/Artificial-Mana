import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const makeCertificate = vi.fn(async () => new Uint8Array([1, 2, 3]));
vi.mock("../lib/certificate", () => ({ makeCertificate: (...a) => makeCertificate(...a) }));
import Certificate from "../app/course/[slug]/Certificate";

const course = { slug: "intro", title: "Intro to AI" };

describe("Certificate", () => {
  it("is locked until all lessons are done and quizzes are passed", () => {
    const { rerender } = render(<Certificate course={course} complete={false} quizOk={true} />);
    expect(screen.getByText(/Finish all lessons and pass every quiz/)).toBeInTheDocument();
    rerender(<Certificate course={course} complete={true} quizOk={false} />);
    expect(screen.getByText(/Finish all lessons and pass every quiz/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download certificate/ })).toBeNull();
  });
  it("asks for a name, then makes the PDF", async () => {
    const u = userEvent.setup();
    URL.createObjectURL = vi.fn(() => "blob:x");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<Certificate course={course} complete={true} quizOk={true} />);
    await u.click(screen.getByRole("button", { name: /Download certificate/ }));
    expect(screen.getByText("Write your name.")).toBeInTheDocument();
    await u.type(screen.getByPlaceholderText("Your full name"), "Ada Lovelace");
    await u.click(screen.getByRole("button", { name: /Download certificate/ }));
    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    expect(makeCertificate).toHaveBeenCalledWith(expect.objectContaining({ name: "Ada Lovelace", courseTitle: "Intro to AI" }));
    expect(localStorage.getItem("cert-name")).toBe("Ada Lovelace");
  });
  it("shows a clear message when the name has letters the PDF cannot print", async () => {
    const u = userEvent.setup();
    makeCertificate.mockRejectedValueOnce(new Error("WinAnsi cannot encode"));
    render(<Certificate course={course} complete={true} quizOk={true} />);
    await u.type(screen.getByPlaceholderText("Your full name"), "राहुल");
    await u.click(screen.getByRole("button", { name: /Download certificate/ }));
    expect(await screen.findByText(/Use English letters/)).toBeInTheDocument();
  });
});
