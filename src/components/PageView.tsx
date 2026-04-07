import { useCallback, useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useWorkspace } from "../context/useWorkspace";
import type { Block } from "../types/block";
import { downloadPageAsPdf } from "../lib/downloadPagePdf";
import DatabaseCanvas from "./DatabaseCanvas";
import Editor from "./Editor";
import PageChrome from "./PageChrome";

export default function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const {
    getPage,
    getDatabase,
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

  const handleBlocksChange = useCallback(
    (blocks: Block[]) => {
      updatePageBlocks(page.id, blocks);
    },
    [page.id, updatePageBlocks]
  );

  return (
    <div className="page-view">
      <PageChrome
        key={`${page.id}:${page.title}`}
        page={page}
        ancestors={breadcrumbAncestors}
        onTitleCommit={(title) => updatePageTitle(page.id, title)}
        onDownloadPdf={() => downloadPageAsPdf(page, getDatabase)}
        onDownloadDocx={() =>
          import("../lib/downloadPageDocx").then((m) =>
            m.downloadPageAsDocx(page, getDatabase)
          )
        }
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
            onBlocksChange={handleBlocksChange}
          />
        )}
      </div>
    </div>
  );
}
