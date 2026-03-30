import { useState } from "react";
import { Link } from "react-router-dom";
import type { Page } from "../types/page";

type Props = {
  page: Page;
  ancestors: Page[];
  onTitleCommit: (title: string) => void;
};

export default function PageChrome({ page, ancestors, onTitleCommit }: Props) {
  const [draft, setDraft] = useState(page.title);

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
    </header>
  );
}
