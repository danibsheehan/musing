import { useState } from "react";
import {
  applyThemeFromStorage,
  getStoredThemePreference,
  setStoredThemePreference,
  type ThemePreference,
} from "../lib/themePreference";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function ThemePreferenceSelect() {
  const [pref, setPref] = useState<ThemePreference>(getStoredThemePreference);

  return (
    <label className="theme-preference-label">
      <span className="theme-preference-label-text">Theme</span>
      <select
        className="theme-preference-select"
        value={pref}
        onChange={(e) => {
          const v = e.target.value as ThemePreference;
          setStoredThemePreference(v);
          setPref(v);
          applyThemeFromStorage();
        }}
        aria-label="Color theme"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
