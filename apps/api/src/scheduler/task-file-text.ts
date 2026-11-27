import { getDocumentProxy } from "unpdf";
import { documentText } from "../topic/statement-text";

// ponytail: plain text, HTML and PDF. A Word file or an archive gets a record
// that says it was not read. Add a parser here when their facts matter.
const TEXT = /\.(md|markdown|txt|json|tsv|csv|ya?ml|patch|diff|log)$/i;
const HTML = /\.html?$/i;
const PDF = /\.pdf$/i;
// A PDF is read up to this many pages and this many characters.
const MAX_PDF_PAGES = 50;
const MAX_PDF_CHARS = 200_000;

/** How a file on an issue is read, or null when it is not text. */
export function fileKind(filename: string, mimeType: string) {
  if (HTML.test(filename) || mimeType === "text/html") return "html" as const;
  if (PDF.test(filename) || mimeType === "application/pdf")
    return "pdf" as const;
  if (TEXT.test(filename) || mimeType.startsWith("text/")) {
    return "text" as const;
  }
  return null;
}

/** The words of a file. For HTML: no scripts, no styles, no tags. */
export const fileText = (kind: "html" | "text", content: string) =>
  kind === "html"
    ? documentText(
        content.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " "),
      )
    : content;

/**
 * The words of a PDF's first pages, one page per paragraph. Reads the bytes
 * only: no fonts, maps or scripts are loaded. Throws on bytes that are not a
 * PDF.
 */
export async function pdfText(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes, {
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  try {
    const pages: string[] = [];
    let length = 0;
    const last = Math.min(pdf.numPages, MAX_PDF_PAGES);
    for (let at = 1; at <= last && length < MAX_PDF_CHARS; at++) {
      const page = await pdf.getPage(at);
      const { items } = await page.getTextContent();
      const text = items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      pages.push(text);
      length += text.length;
    }
    return pages.join("\n\n").slice(0, MAX_PDF_CHARS);
  } finally {
    await pdf.loadingTask.destroy();
  }
}
