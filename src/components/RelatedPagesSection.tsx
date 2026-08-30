import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useWorkspace } from "../context/useWorkspace";
import { isAiServiceConfigured, relatedPages, type RelatedPageMatch } from "../lib/aiClient";

export default function RelatedPagesSection({ pageId }: { pageId: string }) {
  const { getPage } = useWorkspace();
  const [matches, setMatches] = useState<RelatedPageMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMatches(null);
    setError(null);
    if (!isAiServiceConfigured()) return;

    let cancelled = false;
    relatedPages(pageId)
      .then((result) => {
        if (!cancelled) setMatches(result.related);
      })
      .catch((err: unknown) => {
        console.error("Failed to load related pages", err);
        if (!cancelled) setError("Could not load related pages.");
      });

    return () => {
      cancelled = true;
    };
  }, [pageId]);

  if (!isAiServiceConfigured() || (matches === null && !error)) return null;

  return (
    <details className="related-pages-section">
      <summary className="related-pages-summary">Related ({matches?.length ?? 0})</summary>
      {error ? (
        <p className="related-pages-error" role="alert">
          {error}
        </p>
      ) : matches && matches.length === 0 ? (
        <p className="related-pages-empty">No related pages yet.</p>
      ) : (
        <ul className="related-pages-list" role="list">
          {matches?.map((match) => {
            const page = getPage(match.pageId);
            return (
              <li key={match.pageId} className="related-pages-item">
                <Link to={`/page/${match.pageId}`} className="related-pages-link">
                  {page?.title || "Untitled"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
