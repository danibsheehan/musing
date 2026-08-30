import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useWorkspace } from "../context/useWorkspace";
import { isAiServiceConfigured, searchNotes, type SearchMatch } from "../lib/aiClient";
import { blockHtmlToPlainText } from "../lib/blockPlainText";

const DEBOUNCE_MS = 300;
const MAX_RESULTS = 8;
const SNIPPET_LENGTH = 80;

type SearchResultRow = { pageId: string; title: string; snippet: string; similarity: number };

function dedupeByPage(matches: SearchMatch[]): SearchMatch[] {
  const bestByPage = new Map<string, SearchMatch>();
  for (const match of matches) {
    const existing = bestByPage.get(match.pageId);
    if (!existing || match.similarity > existing.similarity) {
      bestByPage.set(match.pageId, match);
    }
  }
  return [...bestByPage.values()].sort((a, b) => b.similarity - a.similarity);
}

export default function SidebarSearch() {
  const { getPage } = useWorkspace();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchNotes(trimmed)
        .then((result) => {
          const rows = dedupeByPage(result.matches)
            .slice(0, MAX_RESULTS)
            .map((match): SearchResultRow => {
              const page = getPage(match.pageId);
              const block = page?.blocks.find((b) => b.id === match.blockId);
              const snippet = block ? blockHtmlToPlainText(block.content) : "";
              return {
                pageId: match.pageId,
                title: page?.title || "Untitled",
                snippet:
                  snippet.length > SNIPPET_LENGTH
                    ? `${snippet.slice(0, SNIPPET_LENGTH)}…`
                    : snippet,
                similarity: match.similarity,
              };
            });
          setResults(rows);
          setOpen(true);
        })
        .catch((err: unknown) => {
          console.error("Search failed", err);
          setResults([]);
          setOpen(true);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, getPage]);

  if (!isAiServiceConfigured()) return null;

  const selectResult = (pageId: string) => {
    setOpen(false);
    setQuery("");
    setResults(null);
    navigate(`/page/${pageId}`);
  };

  return (
    <div className="sidebar-search" ref={containerRef}>
      <input
        type="search"
        className="sidebar-search-input"
        placeholder="Search notes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Search notes"
      />
      {open && results && (
        <div className="sidebar-search-panel" role="listbox">
          {results.length === 0 ? (
            <p className="sidebar-search-empty">No matches.</p>
          ) : (
            results.map((row) => (
              <button
                key={row.pageId}
                type="button"
                className="sidebar-search-result"
                role="option"
                aria-selected={false}
                onClick={() => selectResult(row.pageId)}
              >
                <span className="sidebar-search-result-title">{row.title}</span>
                {row.snippet && (
                  <span className="sidebar-search-result-snippet">{row.snippet}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
