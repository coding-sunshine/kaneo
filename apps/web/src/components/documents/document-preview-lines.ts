export type PreviewLine = { text: string; heading: boolean };

/** Markdown inline marks down to their words: links, emphasis, code. */
const plain = (line: string) =>
  line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|~~|`)/g, "")
    .trim();

/**
 * The first lines of a document as plain text, for the small preview on a
 * pinned card. Headings are marked so the card can set them bolder.
 */
export function previewLines(
  markdown: string | null | undefined,
  max = 8,
): PreviewLine[] {
  const lines: PreviewLine[] = [];
  for (const raw of (markdown ?? "").split("\n")) {
    if (lines.length >= max) break;
    const heading = /^\s*#{1,6}\s/.test(raw);
    const text = plain(
      raw
        .replace(/^\s*#{1,6}\s+/, "")
        .replace(/^\s*>\s?/, "")
        .replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, ""),
    );
    if (!text || /^[-*_]{3,}$/.test(text)) continue;
    lines.push({ text, heading });
  }
  return lines;
}
