import { describe, it, expect, vi, afterEach } from "vitest";
import {
  THEME_PREF_STORAGE_KEY,
  resolveTheme,
  getStoredThemePreference,
  setStoredThemePreference,
  applyResolvedTheme,
  applyThemeFromStorage,
  bindSystemThemeListener,
} from "./themePreference";

function mockMatchMedia(
  prefersDark: boolean,
  addEventListener: (...args: unknown[]) => void = vi.fn(),
) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
      media: query,
      onchange: null,
      addEventListener,
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
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

describe("getStoredThemePreference", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns system when nothing is stored", () => {
    localStorage.removeItem(THEME_PREF_STORAGE_KEY);
    expect(getStoredThemePreference()).toBe("system");
  });

  it.each(["light", "dark", "system"] as const)(
    "returns the stored value %s when valid",
    (pref) => {
      localStorage.setItem(THEME_PREF_STORAGE_KEY, pref);
      expect(getStoredThemePreference()).toBe(pref);
    },
  );

  it("returns system when the stored value is not a recognized preference", () => {
    localStorage.setItem(THEME_PREF_STORAGE_KEY, "not-a-real-theme");
    expect(getStoredThemePreference()).toBe("system");
  });

  it("returns system when localStorage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(getStoredThemePreference()).toBe("system");
  });
});

describe("setStoredThemePreference", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("stores the given preference", () => {
    setStoredThemePreference("dark");
    expect(localStorage.getItem(THEME_PREF_STORAGE_KEY)).toBe("dark");
  });

  it("silently ignores errors when localStorage access throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(() => setStoredThemePreference("light")).not.toThrow();
  });
});

describe("applyResolvedTheme", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it("sets the data-theme attribute on the document element", () => {
    applyResolvedTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    applyResolvedTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("applyThemeFromStorage", () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    vi.unstubAllGlobals();
  });

  it("reads the stored preference, applies it, and returns the resolved theme", () => {
    localStorage.setItem(THEME_PREF_STORAGE_KEY, "dark");
    mockMatchMedia(false);

    expect(applyThemeFromStorage()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("falls back to the system preference when nothing is stored", () => {
    localStorage.removeItem(THEME_PREF_STORAGE_KEY);
    mockMatchMedia(true);

    expect(applyThemeFromStorage()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("bindSystemThemeListener", () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    vi.unstubAllGlobals();
  });

  it("binds the change listener once and reapplies the theme only when preference is system", () => {
    const addEventListener = vi.fn();
    mockMatchMedia(false, addEventListener);

    bindSystemThemeListener();
    bindSystemThemeListener();

    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    const onChange = addEventListener.mock.calls[0][1] as () => void;

    localStorage.setItem(THEME_PREF_STORAGE_KEY, "dark");
    document.documentElement.dataset.theme = "light";
    onChange();
    expect(document.documentElement.dataset.theme).toBe("light");

    localStorage.setItem(THEME_PREF_STORAGE_KEY, "system");
    onChange();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
