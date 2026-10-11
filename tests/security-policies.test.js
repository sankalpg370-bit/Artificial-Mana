import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const policyFiles = [
  ["supabase-step11.sql", "database-steps/supabase-step11.sql"],
  ["supabase-step12.sql", "database-steps/supabase-step12.sql"],
  ["supabase-all.sql", "supabase-all.sql"],
];

describe("creator upload access policies", () => {
  it.each(policyFiles)(
    "%s ties material paths to the authenticated creator",
    (_name, file) => {
      const sql = readFileSync(resolve(process.cwd(), file), "utf8");
      const guardedPath = /storage_path\s+is\s+null\s+or\s+\(storage\.foldername\(storage_path\)\)\[1\]\s*=\s*auth\.uid\(\)::text/gi;
      expect(sql.match(guardedPath)).toHaveLength(2);
    }
  );

  it.each(policyFiles)(
    "%s verifies a stored file path belongs to its creator",
    (_name, file) => {
      const sql = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(sql).toMatch(
        /where m\.storage_path = name\s+and \(storage\.foldername\(name\)\)\[1\] = m\.creator_id::text/i
      );
      expect(sql).not.toMatch(/or\s+owner_id\s*=\s*auth\.uid\(\)::text/i);
    }
  );

  it("Step 11 replaces policies from both creator-material migrations", () => {
    const step11 = readFileSync(resolve(process.cwd(), "database-steps/supabase-step11.sql"), "utf8");
    expect(step11).toMatch(/drop policy if exists "read own or published creator materials"/i);
    expect(step11).toMatch(/drop policy if exists "teachers add own creator materials"/i);
    expect(step11).toMatch(/drop policy if exists "teachers update own creator materials"/i);
    expect(step11).toMatch(/drop policy if exists "teachers delete own creator materials"/i);
  });

  it("limits declared MIME types and upload sizes in Step 14 and the fresh-install SQL", () => {
    for (const file of ["database-steps/supabase-step14.sql", "supabase-all.sql"]) {
      const sql = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(sql).toMatch(/allowed_mime_types\s*=\s*array/i);
      expect(sql).toMatch(/file_size_limit\s*=\s*26214400/i);
      expect(sql).toMatch(/where id = 'creator-materials'/i);
      expect(sql).toMatch(/where id = 'lesson-pdfs'/i);
    }
  });
});
