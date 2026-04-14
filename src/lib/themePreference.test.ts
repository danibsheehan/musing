import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveTheme } from "./themePreference";

function mockMatchMedia(prefersDark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
}

describe("resolveTheme", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns light when preference is light", () => {
    mockMatchMedia(true);
    expect(resolveTheme("light")).toBe("light");
  });

  it("returns dark when preference is dark", () => {
    mockMatchMedia(false);
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("follows system when dark", () => {
    mockMatchMedia(true);
    expect(resolveTheme("system")).toBe("dark");
  });

  it("follows system when light", () => {
    mockMatchMedia(false);
    expect(resolveTheme("system")).toBe("light");
  });
});
