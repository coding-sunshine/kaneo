import { createHtmlToMarkdown } from "@kaneo/importers";
import { fileSlug } from "../../export/file-slug";
import { renderPdf } from "../../export/render-pdf";
import { loadDocument } from "./load-document";

export type DocumentExportFormat = "markdown" | "pdf";

const htmlToMarkdown = createHtmlToMarkdown();
// Pages written in the editor are Markdown; a page stored through the API as
// HTML starts with a block tag and is converted.
const STARTS_AS_HTML =
  /^<(h[1-6]|p|div|table|ul|ol|blockquote|pre|section|article|hr|figure)\b/i;

const contentMarkdown = (content: string) => {
  const body = content.trim();
  return STARTS_AS_HTML.test(body) ? htmlToMarkdown(body) : body;
};

/** The Markdown file of a document: its title as the first heading. */
export function documentMarkdown(title: string, content: string) {
  const body = contentMarkdown(content);
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
      body: renderPdf(doc.title, contentMarkdown(doc.content)),
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
