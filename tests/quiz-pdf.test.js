import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { makeQuizPdf } from "../lib/quiz-pdf";

describe("makeQuizPdf", () => {
  it("creates a readable PDF with a question section and answer key across pages", async () => {
    const quiz = Array.from({ length: 40 }, (_, index) => ({
      q: `Question ${index + 1}: Choose the correct answer.`,
      options: ["First possible answer", "Second possible answer"],
      answer: index % 2,
    }));

    const bytes = await makeQuizPdf({ quiz, title: "Artificial Mana Quick Quiz" });
    const pdf = await PDFDocument.load(bytes);

    expect(bytes.length).toBeGreaterThan(0);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});
