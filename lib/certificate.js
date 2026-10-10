import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Makes the certificate PDF. It uses pdf-lib (MIT license).
// The standard fonts print English letters only.
export async function makeCertificate({ name, courseTitle, date }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]); // A4, landscape
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  const plain = await pdf.embedFont(StandardFonts.Helvetica);
  const blue = rgb(0.23, 0.36, 0.86);
  const dark = rgb(0.12, 0.13, 0.19);
  const grey = rgb(0.4, 0.42, 0.5);

  page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: blue, borderWidth: 4 });
  page.drawRectangle({ x: 36, y: 36, width: 770, height: 523, borderColor: blue, borderWidth: 1 });

  const center = (text, font, size, y, color, maxWidth = 680) => {
    while (font.widthOfTextAtSize(text, size) > maxWidth && size > 12) size -= 1;
    page.drawText(text, { x: (842 - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color });
  };
  center("Certificate of Completion", bold, 42, 440, blue);
  center("This certifies that", plain, 18, 380, grey);
  center(name, italic, 38, 322, dark);
  page.drawLine({ start: { x: 220, y: 308 }, end: { x: 622, y: 308 }, thickness: 1, color: grey });
  center("has finished the course", plain, 18, 268, grey);
  center(courseTitle, bold, 28, 222, dark);
  center(`Date: ${date}`, plain, 14, 140, grey);
  center("Artificial Mana  |  artificialmana.com", plain, 14, 70, blue);
  return pdf.save();
}
