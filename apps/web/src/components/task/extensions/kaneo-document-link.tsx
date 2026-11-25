import {
  isValidUrl,
  KaneoDocumentLink as KaneoDocumentLinkNode,
} from "@kaneo/editor";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { useDocument } from "@/hooks/queries/document/use-documents";
import { extractDocumentLinkFromUrl } from "@/lib/editor-url-utils";

/**
 * A document linked from an issue: its title and status for a reader who can
 * open it, and the bare address for everybody else.
 */
function KaneoDocumentLinkView({ node }: NodeViewProps) {
  const { t } = useTranslation();
  const url = String(node.attrs.url || "");
  const link = url.startsWith(`${window.location.origin}/`)
    ? extractDocumentLinkFromUrl(url)
    : null;
  // ponytail: reads the whole document for a title and a status. Add a
  // summary-by-id route if issues with many links get slow.
  const { data: document } = useDocument(
    link?.workspaceId ?? "",
    link?.documentId ?? "",
  );
  const href = link
    ? `/dashboard/workspace/${link.workspaceId}/document/${link.documentId}`
    : isValidUrl(url)
      ? url
      : undefined;

  return (
    <NodeViewWrapper as="span" className="kaneo-issue-link-node">
      <a
        href={href}
        target={link ? undefined : "_blank"}
        rel={link ? undefined : "noopener noreferrer"}
        className={document ? "kaneo-issue-link-chip" : undefined}
      >
        {document ? (
          <>
            <span className="kaneo-issue-link-title">
              {document.title || t("navigation:documents.untitled")}
            </span>
            <span className="kaneo-issue-link-key">
              {t(`navigation:documents.status.${document.status}`)}
            </span>
          </>
        ) : (
          url
        )}
      </a>
    </NodeViewWrapper>
  );
}

export const KaneoDocumentLink = KaneoDocumentLinkNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(KaneoDocumentLinkView);
  },
});
