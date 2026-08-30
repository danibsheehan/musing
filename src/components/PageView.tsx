import { useCallback, useEffect } from "react";
import { Navigate, useParams } from "react-router";
import { useWorkspace } from "../context/useWorkspace";
import type { Block } from "../types/block";
import { downloadPageAsPdf } from "../lib/downloadPagePdf";
import { isAiServiceConfigured, summarizePage } from "../lib/aiClient";
import { pageBlocksToPlainText } from "../lib/blockPlainText";
import { usePageIndexing } from "../hooks/usePageIndexing";
import DatabaseCanvas from "./DatabaseCanvas";
import Editor from "./Editor";
import PageChrome from "./PageChrome";
import RelatedPagesSection from "./RelatedPagesSection";

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
  const isDocumentPage = page?.layout === "document";

  useEffect(() => {
    if (page) setLastOpenedPageId(page.id);
  }, [page, setLastOpenedPageId]);

  usePageIndexing(page?.id ?? "", isDocumentPage ? (page?.blocks ?? []) : []);

  const handleBlocksChange = useCallback(
    (blocks: Block[]) => {
      if (!pageId) return;
      updatePageBlocks(pageId, blocks);
    },
    [pageId, updatePageBlocks],
  );

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
        onDownloadPdf={() => downloadPageAsPdf(page, getDatabase)}
        onDownloadDocx={() =>
          import("../lib/downloadPageDocx").then((m) => m.downloadPageAsDocx(page, getDatabase))
        }
        onSummarize={
          isDocumentPage && isAiServiceConfigured()
            ? () =>
                summarizePage(page.id, pageBlocksToPlainText(page.blocks)).then((r) => r.summary)
            : undefined
        }
      />
      {isDocumentPage && isAiServiceConfigured() && <RelatedPagesSection pageId={page.id} />}
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
