export function isValidSupabaseConfig(url, key) {
  if (typeof url !== "string" || !url.trim() || typeof key !== "string" || !key.trim()) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const isLocalHttp = parsed.protocol === "http:"
      && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    return (parsed.protocol === "https:" || isLocalHttp)
      && !parsed.username
      && !parsed.password
      && !parsed.search
      && !parsed.hash;
  } catch {
    return false;
  }
}
