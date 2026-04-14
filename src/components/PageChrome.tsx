import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Page } from "../types/page";

type Props = {
  page: Page;
  ancestors: Page[];
  onTitleCommit: (title: string) => void;
  onDownloadPdf?: () => Promise<void>;
  onDownloadDocx?: () => Promise<void>;
};

export default function PageChrome({
  page,
  ancestors,
  onTitleCommit,
  onDownloadPdf,
  onDownloadDocx,
}: Props) {
  const [draft, setDraft] = useState(page.title);
  const [exportBusy, setExportBusy] = useState<null | "pdf" | "docx">(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportDetailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    setDraft(page.title);
  }, [page.id, page.title]);

  useEffect(() => {
    setExportError(null);
    setExportBusy(null);
    const d = exportDetailsRef.current;
    if (d) d.open = false;
  }, [page.id]);

  const closeExportMenu = () => {
    const d = exportDetailsRef.current;
    if (d) d.open = false;
  };

  const runExport = async (kind: "pdf" | "docx", fn: (() => Promise<void>) | undefined) => {
    if (!fn || exportBusy) return;
    closeExportMenu();
    setExportError(null);
    setExportBusy(kind);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      setExportError(
        kind === "pdf"
          ? "Could not export as PDF. Try again, or use Print and choose Save as PDF."
          : "Could not export as Word. Try again."
      );
    } finally {
      setExportBusy(null);
    }
  };

  const hasExport = Boolean(onDownloadPdf || onDownloadDocx);

  return (
    <header className="page-chrome">
      {ancestors.length > 0 && (
        <nav className="page-breadcrumbs" aria-label="Breadcrumb">
          {ancestors.map((a, i) => (
            <span key={a.id} className="page-breadcrumb-segment">
              {i > 0 && <span className="page-breadcrumb-sep"> / </span>}
              <Link to={`/page/${a.id}`} className="page-breadcrumb-link">
                {a.title || "Untitled"}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className="page-chrome-title-row">
        <input
          className="page-title-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onTitleCommit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Page title"
        />
        {hasExport && (
          <details
            ref={exportDetailsRef}
            className="page-export-dropdown"
            onToggle={(e) => {
              if (exportBusy !== null) {
                e.currentTarget.open = false;
              }
            }}
          >
            <summary
              className="page-export-summary"
              aria-label="Export this page. Choose PDF or Word."
              aria-haspopup="menu"
              aria-busy={exportBusy !== null}
            >
              {exportBusy === "pdf"
                ? "PDF…"
                : exportBusy === "docx"
                  ? "Word…"
                  : "Export"}
            </summary>
            <div className="page-export-panel" role="menu">
              {onDownloadPdf && (
                <button
                  type="button"
                  className="page-export-menu-option"
                  role="menuitem"
                  onClick={() => void runExport("pdf", onDownloadPdf)}
                  disabled={exportBusy !== null}
                >
                  <span className="page-export-menu-label">PDF</span>
                  <span className="page-export-menu-hint">.pdf — print or share</span>
                </button>
              )}
              {onDownloadDocx && (
                <button
                  type="button"
                  className="page-export-menu-option"
                  role="menuitem"
                  onClick={() => void runExport("docx", onDownloadDocx)}
                  disabled={exportBusy !== null}
                >
                  <span className="page-export-menu-label">Word</span>
                  <span className="page-export-menu-hint">.docx — edit in Word</span>
                </button>
              )}
            </div>
          </details>
        )}
      </div>
      {exportError && (
        <p className="page-export-error" role="alert">
          {exportError}
        </p>
      )}
    </header>
  );
}
