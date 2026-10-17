// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendMode, hostedConfig, requireLocalBackend } from '../lib/backend-config';
afterEach(() => vi.unstubAllEnvs());
describe('backend deployment configuration', () => {
  it('rejects ephemeral SQLite on Vercel even if the backend flag was omitted', () => {
    vi.stubEnv('VERCEL','1'); vi.stubEnv('NEXT_PUBLIC_BACKEND','local');
    expect(() => requireLocalBackend()).toThrow(/disabled/);
  });
  it('requires valid hosted settings and rejects secret/service-role keys', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','');
    expect(() => hostedConfig()).toThrow(/Set/);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','sb_secret_do_not_expose');
    expect(() => hostedConfig()).toThrow(/never/);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',`x.${btoa(JSON.stringify({role:'service_role'}))}.x`);
    expect(() => hostedConfig()).toThrow(/publishable/);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','sb_publishable_test');
    expect(hostedConfig().url).toBe('https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://example.supabase.co');
    expect(() => hostedConfig()).toThrow(/HTTPS/);
  });
  it('prevents misspelled backend modes from silently using local data', () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND','supabse');
    expect(() => backendMode()).toThrow(/local or supabase/);
  });
});
