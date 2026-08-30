import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isSupabaseConfigured: vi.fn(() => true),
  getSession: vi.fn(async (): Promise<{ data: { session: { access_token: string } | null } }> => ({
    data: { session: { access_token: "test-token" } },
  })),
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: mocks.isSupabaseConfigured,
  getSupabase: () => ({ auth: { getSession: mocks.getSession } }),
}));

describe("aiClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mocks.isSupabaseConfigured.mockReset().mockReturnValue(true);
    mocks.getSession
      .mockReset()
      .mockResolvedValue({ data: { session: { access_token: "test-token" } } });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function load() {
    return import("./aiClient");
  }

  describe("isAiServiceConfigured", () => {
    it("returns false when the service URL is missing", async () => {
      vi.stubEnv("VITE_AI_SERVICE_URL", "");
      const { isAiServiceConfigured } = await load();
      expect(isAiServiceConfigured()).toBe(false);
    });

    it("returns false when the service URL still has the placeholder", async () => {
      vi.stubEnv("VITE_AI_SERVICE_URL", "https://YOUR-SERVICE.run.app");
      const { isAiServiceConfigured } = await load();
      expect(isAiServiceConfigured()).toBe(false);
    });

    it("returns false when Supabase is not configured, even with a real URL", async () => {
      vi.stubEnv("VITE_AI_SERVICE_URL", "https://musing-ai-service.run.app");
      mocks.isSupabaseConfigured.mockReturnValue(false);
      const { isAiServiceConfigured } = await load();
      expect(isAiServiceConfigured()).toBe(false);
    });

    it("returns true when both are configured", async () => {
      vi.stubEnv("VITE_AI_SERVICE_URL", "https://musing-ai-service.run.app");
      const { isAiServiceConfigured } = await load();
      expect(isAiServiceConfigured()).toBe(true);
    });
  });

  describe("requests", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_AI_SERVICE_URL", "https://musing-ai-service.run.app");
    });

    it("attaches the bearer token and calls the right endpoint", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ summary: "hi", cached: false }), { status: 200 }),
      );

      const { summarizePage } = await load();
      const result = await summarizePage("page-1", "some content");

      expect(result).toEqual({ summary: "hi", cached: false });
      const [calledUrl, init] = fetchMock.mock.calls[0];
      expect(calledUrl).toBe("https://musing-ai-service.run.app/api/summarize-page");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer test-token" });
      expect(JSON.parse(init?.body as string)).toEqual({
        pageId: "page-1",
        content: "some content",
      });
    });

    it("throws AiServiceError with the response's error message on failure", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockImplementation(
        async () =>
          new Response(JSON.stringify({ error: "Monthly anthropic budget reached" }), {
            status: 429,
          }),
      );

      const { summarizePage, AiServiceError } = await load();
      await expect(summarizePage("page-1", "content")).rejects.toThrow(AiServiceError);
      await expect(summarizePage("page-1", "content")).rejects.toThrow(
        "Monthly anthropic budget reached",
      );
    });

    it("rejects with a 401 AiServiceError when there is no active session", async () => {
      mocks.getSession.mockResolvedValue({ data: { session: null } });
      const { getUsage, AiServiceError } = await load();
      await expect(getUsage()).rejects.toThrow(AiServiceError);
    });

    it("rejects immediately when not configured, without calling fetch", async () => {
      vi.stubEnv("VITE_AI_SERVICE_URL", "");
      const fetchMock = vi.mocked(fetch);
      const { getUsage } = await load();
      await expect(getUsage()).rejects.toThrow("AI service is not configured");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
