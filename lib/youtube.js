const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
]);

export function getYouTubeVideoId(value) {
  const input = value.trim();
  if (/^[\w-]{11}$/.test(input)) return input;

  let url;
  try {
    const urlInput = input.startsWith("//")
      ? `https:${input}`
      : /^https?:\/\//i.test(input) ? input : `https://${input}`;
    url = new URL(urlInput);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!YOUTUBE_HOSTS.has(host)) return null;

  const [firstPathSegment, secondPathSegment] = url.pathname.split("/").filter(Boolean);
  let videoId;
  if (host === "youtu.be") {
    videoId = firstPathSegment;
  } else if (firstPathSegment === "watch") {
    videoId = url.searchParams.get("v");
  } else if (["embed", "live", "shorts", "v"].includes(firstPathSegment)) {
    videoId = secondPathSegment;
  }

  return videoId && /^[\w-]{11}$/.test(videoId) ? videoId : null;
}
