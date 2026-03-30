import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useWorkspace } from "../context/useWorkspace";
import DatabaseCanvas from "./DatabaseCanvas";
import Editor from "./Editor";
import PageChrome from "./PageChrome";

export default function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const {
    getPage,
    setLastOpenedPageId,
    updatePageTitle,
    updatePageBlocks,
    ancestryFor,
    externalWorkspaceRevision,
  } = useWorkspace();

  const page = pageId ? getPage(pageId) : undefined;

  useEffect(() => {
    if (page) setLastOpenedPageId(page.id);
  }, [page, setLastOpenedPageId]);

  if (!pageId || !page) {
    return <Navigate to="/" replace />;
  }

  const fullChain = ancestryFor(page.id);
  const breadcrumbAncestors = fullChain.slice(0, -1);

  return (
    <div className="page-view">
      <PageChrome
        key={`${page.id}:${page.title}`}
        page={page}
        ancestors={breadcrumbAncestors}
        onTitleCommit={(title) => updatePageTitle(page.id, title)}
      />
      <div className="page-editor-wrap">
        {page.layout === "database" && page.databaseId ? (
          <DatabaseCanvas key={page.databaseId} databaseId={page.databaseId} />
        ) : (
          <Editor
            key={page.id}
            pageId={page.id}
            blocks={page.blocks}
            externalWorkspaceRevision={externalWorkspaceRevision}
            onBlocksChange={(blocks) => updatePageBlocks(page.id, blocks)}
          />
        )}
      </div>
    </div>
  );
}
