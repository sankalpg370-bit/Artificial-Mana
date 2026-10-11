import { describe, expect, it } from "vitest";
import { isValidSupabaseConfig } from "../lib/supabase-config.js";

describe("Supabase environment configuration", () => {
  it("accepts a public HTTPS endpoint and anon key", () => {
    expect(isValidSupabaseConfig("https://project.supabase.co", "public-anon-key")).toBe(true);
  });

  it("allows local HTTP endpoints for development", () => {
    expect(isValidSupabaseConfig("http://localhost:54321", "public-anon-key")).toBe(true);
  });

  it("rejects missing credentials and unsafe or malformed endpoints", () => {
    expect(isValidSupabaseConfig("", "public-anon-key")).toBe(false);
    expect(isValidSupabaseConfig("https://project.supabase.co", "")).toBe(false);
    expect(isValidSupabaseConfig("http://project.supabase.co", "public-anon-key")).toBe(false);
    expect(isValidSupabaseConfig("https://user:password@project.supabase.co", "public-anon-key")).toBe(false);
    expect(isValidSupabaseConfig("not a URL", "public-anon-key")).toBe(false);
  });
});
