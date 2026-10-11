import { describe, expect, it } from "vitest";
import { getYouTubeVideoId } from "../lib/youtube";

describe("getYouTubeVideoId", () => {
  it.each([
    ["aircAruvnKk", "aircAruvnKk"],
    ["https://www.youtube.com/watch?v=aircAruvnKk", "aircAruvnKk"],
    ["https://www.youtube.com/watch?feature=shared&v=aircAruvnKk", "aircAruvnKk"],
    ["//youtu.be/aircAruvnKk", "aircAruvnKk"],
    ["https://youtu.be/aircAruvnKk?si=share-token", "aircAruvnKk"],
    ["https://youtube.com/shorts/aircAruvnKk", "aircAruvnKk"],
    ["https://m.youtube.com/live/aircAruvnKk?feature=share", "aircAruvnKk"],
    ["youtube.com/embed/aircAruvnKk", "aircAruvnKk"],
  ])("extracts the ID from %s", (value, expected) => {
    expect(getYouTubeVideoId(value)).toBe(expected);
  });

  it.each([
    "https://example.com/watch?v=aircAruvnKk",
    "https://youtube.com/watch?v=too-short",
    "not a YouTube link",
  ])("rejects unsupported or invalid input: %s", (value) => {
    expect(getYouTubeVideoId(value)).toBeNull();
  });
});
