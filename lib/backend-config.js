import { HttpError } from "./server/http.mjs";

// Public configuration only. Never put a service-role/secret key in these variables.
export function backendMode() {
  const mode = process.env.NEXT_PUBLIC_BACKEND || "local";
  if (!["local", "supabase"].includes(mode)) throw new Error("NEXT_PUBLIC_BACKEND must be local or supabase.");
  return mode;
}

// Hosted visitors learn as guests unless registration is explicitly enabled.
export function publicSignupEnabled() {
  const setting = process.env.NEXT_PUBLIC_ALLOW_SIGNUP;
  return setting === "1" || (setting !== "0" && backendMode() === "local");
}

export function hostedConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for the hosted backend.");
  const address = new URL(url);
  if (address.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(address.hostname)) throw new Error("The hosted backend requires HTTPS.");
  if (key.startsWith("sb_secret_")) throw new Error("Use a publishable key, never a Supabase secret key.");
  if (!key.startsWith("sb_publishable_")) {
    let role;
    try { role = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role; } catch { /* Invalid keys fail without revealing their value. */ }
    if (role !== "anon") throw new Error("Use a Supabase publishable or legacy anon key.");
  }
  return { url: address.origin, key };
}

export function requireLocalBackend() {
  if (backendMode() !== "local" || process.env.VERCEL === "1") {
    throw new HttpError("Local account, data and file APIs are disabled on hosted deployments.", 503);
  }
}
