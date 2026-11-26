import { documentText } from "../topic/statement-text";

// ponytail: plain text and HTML only. A PDF, a Word file or an archive gets a
// record that says it was not read. Add a parser here when their facts matter.
const TEXT = /\.(md|markdown|txt|json|tsv|csv|ya?ml|patch|diff|log)$/i;
const HTML = /\.html?$/i;

/** How a file on an issue is read, or null when it is not text. */
export function fileKind(filename: string, mimeType: string) {
  if (HTML.test(filename) || mimeType === "text/html") return "html" as const;
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
