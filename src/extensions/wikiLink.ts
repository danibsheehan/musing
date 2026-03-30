import { InputRule, Mark, mergeAttributes } from "@tiptap/core";
import type { Page } from "../types/page";
import { resolveWikiTarget } from "../lib/resolveWikiPage";

export type WikiLinkOptions = {
  getPages: () => Page[];
};

export const WikiLink = Mark.create<WikiLinkOptions>({
  name: "wikiLink",

  addOptions() {
    return {
      getPages: () => [] as Page[],
    };
  },

  inclusive: false,
  exitable: true,

  addAttributes() {
    return {
      pageId: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-wiki-page-id"),
        renderHTML: (attrs) => {
          if (!attrs.pageId) return {};
          return { "data-wiki-page-id": attrs.pageId };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "a[data-wiki-page-id]",
        getAttrs: (el) => ({
          pageId: (el as HTMLElement).getAttribute("data-wiki-page-id"),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    const pageId = mark.attrs.pageId as string | null;
    if (!pageId) {
      return [
        "span",
        mergeAttributes(HTMLAttributes, { class: "wiki-link-missing" }),
        0,
      ];
    }
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        class: "wiki-link",
        href: `/page/${pageId}`,
        "data-wiki-page-id": pageId,
        rel: "noopener noreferrer",
      }),
      0,
    ];
  },

  addInputRules() {
    const markName = this.name;
    const getPages = () => this.options.getPages();
    return [
      new InputRule({
        find: /\[\[([^\]]+)\]\]$/,
        handler: ({ range, match, chain }) => {
          const target = resolveWikiTarget(getPages(), match[1]);
          if (!target) return null;
          chain()
            .deleteRange(range)
            .insertContent({
              type: "text",
              text: target.title,
              marks: [{ type: markName, attrs: { pageId: target.id } }],
            })
            .run();
        },
      }),
    ];
  },
});
