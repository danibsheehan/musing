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
  /**
   * Marks `node_modules` sources as ignore-listed in dev source maps so DevTools / debuggers
   * treat ProseMirror (e.g. `resolveCached`, `filterTransaction`) as library code — fewer spurious
   * stops when stepping or when ignore-list is not applied to prebundled deps.
   */
  server: {
    sourcemapIgnoreList(sourcePath) {
      return sourcePath.includes("node_modules");
    },
  },
  /**
   * Rolldown does not resolve `@tiptap/pm/*` export subpaths (see tiptap pm package.json
   * `exports`). Each subpath re-exports a `prosemirror-*` package — alias explicitly.
   */
  resolve: {
    alias: {
      "@tiptap/pm/changeset": "prosemirror-changeset",
      "@tiptap/pm/collab": "prosemirror-collab",
      "@tiptap/pm/commands": "prosemirror-commands",
      "@tiptap/pm/dropcursor": "prosemirror-dropcursor",
      "@tiptap/pm/gapcursor": "prosemirror-gapcursor",
      "@tiptap/pm/history": "prosemirror-history",
      "@tiptap/pm/inputrules": "prosemirror-inputrules",
      "@tiptap/pm/keymap": "prosemirror-keymap",
      "@tiptap/pm/markdown": "prosemirror-markdown",
      "@tiptap/pm/menu": "prosemirror-menu",
      "@tiptap/pm/model": "prosemirror-model",
      "@tiptap/pm/schema-basic": "prosemirror-schema-basic",
      "@tiptap/pm/schema-list": "prosemirror-schema-list",
      "@tiptap/pm/state": "prosemirror-state",
      "@tiptap/pm/tables": "prosemirror-tables",
      "@tiptap/pm/trailing-node": "prosemirror-trailing-node",
      "@tiptap/pm/transform": "prosemirror-transform",
      "@tiptap/pm/view": "prosemirror-view",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
