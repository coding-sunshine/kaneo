import { getDocumentProxy } from "unpdf";
import { documentText } from "../topic/statement-text";
import { ARCHIVE, archiveText } from "./archive-text";
import { docxText } from "./docx-text";

// ponytail: plain text, HTML, PDF, Word and zip, gzip or tar archives. Any
// other file gets a record that says it was not read. Add a parser here when
// its facts matter.
const TEXT = /\.(md|markdown|txt|json|tsv|csv|ya?ml|patch|diff|log)$/i;
const HTML = /\.html?$/i;
const PDF = /\.pdf$/i;
const DOCX = /\.docx$/i;
const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ARCHIVE_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-gzip",
  "application/x-tar",
  "application/x-gtar",
]);
// A PDF is read up to this many pages and this many characters.
const MAX_PDF_PAGES = 50;
const MAX_PDF_CHARS = 200_000;

/** How a file on an issue is read, or null when it is not text. */
export function fileKind(filename: string, mimeType: string) {
  // By name first: a Word file is a zip, and is often sent as one.
  if (DOCX.test(filename)) return "docx" as const;
  if (ARCHIVE.test(filename)) return "archive" as const;
  if (HTML.test(filename) || mimeType === "text/html") return "html" as const;
  if (PDF.test(filename) || mimeType === "application/pdf")
    return "pdf" as const;
  if (mimeType === DOCX_TYPE) return "docx" as const;
  if (TEXT.test(filename) || mimeType.startsWith("text/")) {
    return "text" as const;
  }
  if (ARCHIVE_TYPES.has(mimeType)) return "archive" as const;
  return null;
}

export type FileKind = NonNullable<ReturnType<typeof fileKind>>;

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

/**
 * The words of a file of a kind that has a reader. A member of an archive is
 * read by its name. Throws on bytes that cannot be read as that kind.
 */
export async function readFileText(
  kind: FileKind,
  bytes: Uint8Array,
  filename: string,
): Promise<string> {
  if (kind === "pdf") return pdfText(bytes);
  if (kind === "docx") return docxText(bytes);
  if (kind === "archive") {
    return archiveText(filename, bytes, {
      readable: (path) => fileKind(path, "") !== null,
      read: async (path, member) => {
        const inner = fileKind(path, "");
        return inner && inner !== "archive"
          ? readFileText(inner, member, path)
          : "";
      },
    });
  }
  return fileText(kind, new TextDecoder().decode(bytes));
}
