import { useRef } from "react";
import { useDocuments } from "@/hooks/queries/document/use-documents";
import { LinkedDocumentAccessRow } from "./linked-document-access-row";

type LinkedDocumentAccessWarningProps = {
  workspaceId: string;
  taskId: string;
};

/** A row for each document linked in the issue's text after the page opened. */
export function LinkedDocumentAccessWarning({
  workspaceId,
  taskId,
}: LinkedDocumentAccessWarningProps) {
  const { data } = useDocuments(workspaceId, { linkedTaskId: taskId });
  const first = useRef<Set<string> | null>(null);
  if (!data) return null;
  // ponytail: a link someone else adds while the page is open warns too; track the saver if that annoys.
  first.current ??= new Set(data.map((document) => document.id));
  const seen = first.current;
  return data
    .filter((document) => !seen.has(document.id))
    .map((document) => (
      <LinkedDocumentAccessRow
        key={document.id}
        workspaceId={workspaceId}
        taskId={taskId}
        documentId={document.id}
        title={document.title}
      />
    ));
}
