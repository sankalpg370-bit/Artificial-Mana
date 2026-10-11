import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import sitemap from "../app/sitemap";
import robots from "../app/robots";
import Privacy from "../app/privacy/page";

describe("site address", () => {
  it("uses the www address in the sitemap and robots file", async () => {
    const urls = (await sitemap()).map((u) => u.url);
    expect(urls[0]).toBe("https://www.artificialmana.com");
    expect(urls.every((u) => u.startsWith("https://www.artificialmana.com"))).toBe(true);
    expect(robots().sitemap).toBe("https://www.artificialmana.com/sitemap.xml");
    expect(robots().rules.disallow).toEqual(expect.arrayContaining(["/admin", "/login", "/management"]));
  });
});

describe("privacy page", () => {
  it("says that administrators can read account data, and describes local storage", () => {
    render(<Privacy />);
    expect(screen.getByText(/Site administrators can read them/)).toBeInTheDocument();
    expect(screen.getByText(/site operator/)).toBeInTheDocument();
  });
});
