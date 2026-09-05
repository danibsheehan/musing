import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Page } from "../types/page";
import PageChrome from "./PageChrome";

const page = (overrides: Partial<Page> = {}): Page => ({
  id: "page-a",
  title: "Alpha",
  parentId: null,
  order: 0,
  updatedAt: "",
  layout: "document",
  databaseId: null,
  blocks: [],
  ...overrides,
});

function renderChrome(props: Partial<ComponentProps<typeof PageChrome>> = {}) {
  const onTitleCommit = vi.fn();
  const utils = render(
    <MemoryRouter>
      <PageChrome page={page()} ancestors={[]} onTitleCommit={onTitleCommit} {...props} />
    </MemoryRouter>,
  );
  return { onTitleCommit, ...utils };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("PageChrome", () => {
  describe("breadcrumbs", () => {
    it("renders no breadcrumb nav when there are no ancestors", () => {
      renderChrome({ ancestors: [] });
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("renders a link per ancestor, falling back to 'Untitled' for an empty title", () => {
      const ancestors = [page({ id: "root", title: "Root" }), page({ id: "mid", title: "" })];
      renderChrome({ ancestors });

      expect(screen.getByRole("link", { name: "Root" })).toHaveAttribute("href", "/page/root");
      expect(screen.getByRole("link", { name: "Untitled" })).toHaveAttribute("href", "/page/mid");
    });
  });

  describe("title", () => {
    it("commits the current draft on blur", async () => {
      const user = userEvent.setup();
      const { onTitleCommit } = renderChrome({ page: page({ title: "Alpha" }) });

      const input = screen.getByRole("textbox", { name: "Page title" });
      expect(input).toHaveValue("Alpha");

      await user.clear(input);
      await user.type(input, "Beta");
      await user.tab();

      expect(onTitleCommit).toHaveBeenCalledWith("Beta");
    });

    it("blurs (committing) on Enter", async () => {
      const user = userEvent.setup();
      const { onTitleCommit } = renderChrome();

      const input = screen.getByRole("textbox", { name: "Page title" });
      await user.clear(input);
      await user.type(input, "New Title{Enter}");

      expect(onTitleCommit).toHaveBeenCalledWith("New Title");
      expect(input).not.toHaveFocus();
    });

    it("resets the draft when the page prop changes", () => {
      const { rerender } = render(
        <MemoryRouter>
          <PageChrome
            page={page({ id: "a", title: "Alpha" })}
            ancestors={[]}
            onTitleCommit={vi.fn()}
          />
        </MemoryRouter>,
      );
      expect(screen.getByRole("textbox", { name: "Page title" })).toHaveValue("Alpha");

      rerender(
        <MemoryRouter>
          <PageChrome
            page={page({ id: "b", title: "Beta" })}
            ancestors={[]}
            onTitleCommit={vi.fn()}
          />
        </MemoryRouter>,
      );
      expect(screen.getByRole("textbox", { name: "Page title" })).toHaveValue("Beta");
    });
  });

  describe("summarize", () => {
    it("does not render the summarize button when onSummarize is absent", () => {
      renderChrome();
      expect(screen.queryByRole("button", { name: /Summarize/ })).not.toBeInTheDocument();
    });

    it("shows a busy state, then the summary in a dismissible panel", async () => {
      const user = userEvent.setup();
      const { promise, resolve } = deferred<string>();
      const onSummarize = vi.fn(() => promise);
      renderChrome({ onSummarize });

      const button = screen.getByRole("button", { name: "Summarize" });
      await user.click(button);

      expect(onSummarize).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Summarizing…" })).toBeDisabled();

      resolve("This is the summary.");
      expect(await screen.findByRole("status")).toHaveTextContent("This is the summary.");

      await user.click(screen.getByRole("button", { name: "Dismiss summary" }));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows an error message when summarizing fails", async () => {
      const user = userEvent.setup();
      const onSummarize = vi.fn().mockRejectedValue(new Error("boom"));
      renderChrome({ onSummarize });

      await user.click(screen.getByRole("button", { name: "Summarize" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Could not summarize this page. Try again.",
      );
    });
  });

  describe("export", () => {
    it("does not render the export menu when neither download handler is passed", () => {
      renderChrome();
      expect(screen.queryByText("Export")).not.toBeInTheDocument();
    });

    it("only shows the PDF option when onDownloadDocx is absent", () => {
      renderChrome({ onDownloadPdf: vi.fn() });
      expect(screen.getByRole("menuitem", { name: /PDF/ })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /Word/ })).not.toBeInTheDocument();
    });

    it("exports as PDF: busy label, disabled items, then idle again", async () => {
      const user = userEvent.setup();
      const { promise, resolve } = deferred<void>();
      const onDownloadPdf = vi.fn(() => promise);
      renderChrome({ onDownloadPdf, onDownloadDocx: vi.fn() });

      await user.click(screen.getByRole("menuitem", { name: /PDF/ }));
      expect(onDownloadPdf).toHaveBeenCalledTimes(1);
      expect(screen.getByText("PDF…")).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Word/ })).toBeDisabled();

      await act(async () => {
        resolve();
        await promise;
      });
      expect(screen.getByText("Export")).toBeInTheDocument();
    });

    it("shows a Word-specific error message when the docx export fails", async () => {
      const user = userEvent.setup();
      const onDownloadDocx = vi.fn().mockRejectedValue(new Error("boom"));
      renderChrome({ onDownloadDocx });

      await user.click(screen.getByRole("menuitem", { name: /Word/ }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Could not export as Word.");
    });
  });

  it("clears prior export/summarize state when navigating to a different page", async () => {
    const user = userEvent.setup();
    const onSummarize = vi.fn().mockResolvedValue("Summary for A");
    const { rerender } = render(
      <MemoryRouter>
        <PageChrome
          page={page({ id: "a", title: "Alpha" })}
          ancestors={[]}
          onTitleCommit={vi.fn()}
          onSummarize={onSummarize}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Summarize" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Summary for A");

    rerender(
      <MemoryRouter>
        <PageChrome
          page={page({ id: "b", title: "Beta" })}
          ancestors={[]}
          onTitleCommit={vi.fn()}
          onSummarize={onSummarize}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
