import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getStoredThemePreference,
  setStoredThemePreference,
  applyThemeFromStorage,
} from "../lib/themePreference";
import ThemePreferenceSelect from "./ThemePreferenceSelect";

vi.mock("../lib/themePreference", () => ({
  getStoredThemePreference: vi.fn(),
  setStoredThemePreference: vi.fn(),
  applyThemeFromStorage: vi.fn(),
}));

describe("ThemePreferenceSelect", () => {
  beforeEach(() => {
    vi.mocked(getStoredThemePreference).mockReturnValue("system");
    vi.mocked(setStoredThemePreference).mockReset();
    vi.mocked(applyThemeFromStorage).mockReset();
  });

  it("initializes the select from the stored preference", () => {
    vi.mocked(getStoredThemePreference).mockReturnValue("dark");
    render(<ThemePreferenceSelect />);

    expect(screen.getByRole("combobox", { name: "Color theme" })).toHaveValue("dark");
  });

  it("persists and applies the new preference when changed", async () => {
    const user = userEvent.setup();
    render(<ThemePreferenceSelect />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Color theme" }), "Light");

    expect(setStoredThemePreference).toHaveBeenCalledWith("light");
    expect(applyThemeFromStorage).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("combobox", { name: "Color theme" })).toHaveValue("light");
  });
});
