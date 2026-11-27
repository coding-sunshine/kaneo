import { fileSlug } from "../../export/file-slug";
import { renderPdf } from "../../export/render-pdf";
import { loadDocument } from "./load-document";

export type DocumentExportFormat = "markdown" | "pdf";

/** The Markdown file of a document: its title as the first heading. */
export function documentMarkdown(title: string, content: string) {
  const body = content.trim();
  return `# ${title || "Untitled"}\n\n${body ? `${body}\n` : ""}`;
}

// A document the user can open, as a file. 404 when they cannot.
export async function exportDocument(
  workspaceId: string,
  id: string,
  userId: string,
  format: DocumentExportFormat,
) {
  const doc = await loadDocument(workspaceId, id, userId);
  const name = fileSlug(doc.title);
  if (format === "pdf") {
    return {
      body: renderPdf(doc.title, doc.content),
      contentType: "application/pdf",
      filename: `${name}.pdf`,
    };
  }
  return {
    body: documentMarkdown(doc.title, doc.content),
    contentType: "text/markdown; charset=utf-8",
    filename: `${name}.md`,
  };
}
