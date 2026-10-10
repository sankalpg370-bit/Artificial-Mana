import { describe, it, expect } from "vitest";
import { safeHtml } from "../lib/richtext";

describe("safeHtml (notes safety)", () => {
  it("keeps allowed formats", () => {
    const out = safeHtml("<p>Hi <strong>bold</strong></p><ul><li><p>one</p></li></ul>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<li>");
  });
  it("removes scripts, images with code, event code, and javascript links", () => {
    const out = safeHtml('<p>x</p><script>alert(1)</script><img src=x onerror=alert(1)><p onclick="alert(2)">y <a href="javascript:alert(3)">l</a></p>');
    expect(out).not.toMatch(/script|onerror|onclick|javascript|<img|<a /i);
    expect(out).toContain("y");
  });
  it("shows old plain-text notes and escapes them", () => {
    const out = safeHtml("line one\nline <b>two</b>");
    expect(out).toContain("<br>");
    expect(out).toContain("&lt;b&gt;");
  });
});
