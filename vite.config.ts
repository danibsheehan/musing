import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * GitHub project pages: https://<user>.github.io/<repo>/
 * User/org site: repo named <user>.github.io → served at site root (base "/").
 */
function pagesBase(): string {
  if (process.env.VITE_BASE_PATH) {
    const p = process.env.VITE_BASE_PATH.trim();
    if (!p || p === "/") return "/";
    return p.endsWith("/") ? p : `${p}/`;
  }
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (
    process.env.GITHUB_ACTIONS === "true" &&
    repo &&
    !repo.toLowerCase().endsWith(".github.io")
  ) {
    return `/${repo}/`;
  }
  return "/";
}

// https://vite.dev/config/
export default defineConfig({
  base: pagesBase(),
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
