export const THEME_PREF_STORAGE_KEY = "musing-theme-pref";

export type ThemePreference = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export function getStoredThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_PREF_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* private mode, etc. */
  }
  return "system";
}

export function setStoredThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_PREF_STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
}

export function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "dark") return "dark";
  if (pref === "light") return "light";
  return getSystemDark() ? "dark" : "light";
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
}

/** Read localStorage, apply `data-theme` on `<html>`, return resolved theme. */
export function applyThemeFromStorage(): ResolvedTheme {
  const pref = getStoredThemePreference();
  const resolved = resolveTheme(pref);
  applyResolvedTheme(resolved);
  return resolved;
}

let systemListenerBound = false;

/** When preference is `system`, re-apply if OS theme changes. */
export function bindSystemThemeListener(): void {
  if (systemListenerBound) return;
  systemListenerBound = true;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (getStoredThemePreference() === "system") {
      applyThemeFromStorage();
    }
  };
  mq.addEventListener("change", onChange);
}
