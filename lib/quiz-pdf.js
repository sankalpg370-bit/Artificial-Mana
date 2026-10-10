import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export async function makeQuizPdf({ quiz, title }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const color = rgb(0.12, 0.13, 0.19);
  let page;
  let y;

  function addPage() {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  function drawWrapped(text, { font = regular, size = 11, indent = 0, gap = 4 } = {}) {
    const maxWidth = CONTENT_WIDTH - indent;
    const words = String(text).split(/\s+/).flatMap((word) => {
      if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
      const chunks = [];
      let chunk = "";
      for (const char of word) {
        if (chunk && font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
          chunks.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      if (chunk) chunks.push(chunk);
      return chunks;
    });
    let line = "";
    const lines = [];

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);

    for (const item of lines) {
      if (y < MARGIN + size * 1.5) addPage();
      page.drawText(item, { x: MARGIN + indent, y, size, font, color });
      y -= size + gap;
    }
  }

  addPage();
  drawWrapped(title, { font: bold, size: 18, gap: 8 });
  drawWrapped("Quiz questions", { font: bold, size: 13, gap: 10 });

  quiz.forEach((question, index) => {
    drawWrapped(`${index + 1}. ${question.q}`, { font: bold, size: 11, gap: 3 });
    question.options.forEach((option, optionIndex) => {
      drawWrapped(`${String.fromCharCode(65 + optionIndex)}. ${option}`, { indent: 14, gap: 2 });
    });
    y -= 7;
  });

  y -= 8;
  drawWrapped("Answer key", { font: bold, size: 14, gap: 10 });
  quiz.forEach((question, index) => {
    drawWrapped(`${index + 1}. ${String.fromCharCode(65 + question.answer)}. ${question.options[question.answer]}`, {
      gap: 4,
    });
  });

  return pdf.save();
}
