import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ __mockClient: true })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

describe("supabaseClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mocks.createClient.mockClear();
    mocks.createClient.mockImplementation(() => ({ __mockClient: true }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function load() {
    return import("./supabaseClient");
  }

  describe("isSupabaseConfigured", () => {
    it("returns false when URL is missing", async () => {
      vi.stubEnv("VITE_SUPABASE_URL", "");
      vi.stubEnv("VITE_SUPABASE_ANON_KEY", "x".repeat(21));
      const { isSupabaseConfigured } = await load();
      expect(isSupabaseConfigured()).toBe(false);
    });

    it("returns false when anon key is missing", async () => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
      vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
      const { isSupabaseConfigured } = await load();
      expect(isSupabaseConfigured()).toBe(false);
    });

    it("returns false when URL contains placeholder project id", async () => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://your-project.supabase.co");
      vi.stubEnv("VITE_SUPABASE_ANON_KEY", "x".repeat(21));
      const { isSupabaseConfigured } = await load();
      expect(isSupabaseConfigured()).toBe(false);
    });

    it("returns false when anon key is too short", async () => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
      vi.stubEnv("VITE_SUPABASE_ANON_KEY", "x".repeat(20));
      const { isSupabaseConfigured } = await load();
      expect(isSupabaseConfigured()).toBe(false);
    });

    it("returns true when URL and key look valid", async () => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
      vi.stubEnv("VITE_SUPABASE_ANON_KEY", "x".repeat(21));
      const { isSupabaseConfigured } = await load();
      expect(isSupabaseConfigured()).toBe(true);
    });
  });

  describe("getSupabase", () => {
    it("throws when not configured", async () => {
      vi.stubEnv("VITE_SUPABASE_URL", "");
      vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
      const { getSupabase } = await load();
      expect(() => getSupabase()).toThrow(/Supabase is not configured/);
      expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it("creates and returns a client when configured", async () => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
      vi.stubEnv("VITE_SUPABASE_ANON_KEY", "x".repeat(21));
      const { getSupabase } = await load();
      const a = getSupabase();
      const b = getSupabase();
      expect(a).toBe(b);
      expect(mocks.createClient).toHaveBeenCalledTimes(1);
      expect(mocks.createClient).toHaveBeenCalledWith(
        "https://abc.supabase.co",
        "x".repeat(21),
        expect.objectContaining({
          auth: { persistSession: true, autoRefreshToken: true },
        })
      );
    });
  });
});
