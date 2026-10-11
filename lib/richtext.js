import StarterKit from "@tiptap/starter-kit";
import { generateHTML, generateJSON } from "@tiptap/html";

// The note editor allows only these formats: bold, italic, strike, headings, lists, quote, code.
// Links are off on purpose. This keeps the notes safe.
export const extensions = [StarterKit.configure({ link: false })];

const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// Make a note safe to show. The editor rules remove anything else (scripts, images, event code).
// Old notes were plain text. This also shows them.
export function safeHtml(content) {
  // Malformed or legacy database rows must not crash the entire lesson.
  content = typeof content === "string" ? content : "";
  const raw = /^\s*<(p|h[1-6]|ul|ol|blockquote|pre)[\s>]/i.test(content)
    ? content
    : "<p>" + esc(content).replace(/\n/g, "<br>") + "</p>";
  try {
    return generateHTML(generateJSON(raw, extensions), extensions);
  } catch (e) {
    return "<p>" + esc(content) + "</p>";
  }
}
