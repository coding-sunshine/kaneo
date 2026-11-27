// The block structure of a document's Markdown, as the PDF export lays it
// out. Covers what the editor writes: headings, paragraphs, lists, task lists,
// quotes, code, rules and pipe tables. Inline marks are reduced to text.
export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "item"; marker: string; depth: number; text: string }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "rule" };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const ITEM = /^(\s*)([-*+]|\d+[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/;
const FENCE = /^\s*(```|~~~)/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** Markdown inline marks reduced to the text a reader sees. */
export function plainInline(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_, label, url) =>
      label === url ? url : `${label} (${url})`,
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\w)__(.+?)__(?!\w)/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, "$1")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function tableCells(line: string) {
  const cells = line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/);
  return cells.map((cell) => plainInline(cell));
}

export function markdownBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) {
      blocks.push({
        type: "paragraph",
        text: plainInline(paragraph.join(" ")),
      });
    }
    paragraph = [];
  };

  for (let at = 0; at < lines.length; at++) {
    const line = lines[at] ?? "";
    if (!line.trim()) {
      flush();
      continue;
    }
    if (FENCE.test(line)) {
      flush();
      const code: string[] = [];
      while (++at < lines.length && !FENCE.test(lines[at] ?? "")) {
        code.push(lines[at] ?? "");
      }
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: "heading",
        level: heading[1]?.length ?? 1,
        text: plainInline(heading[2] ?? ""),
      });
      continue;
    }
    if (RULE.test(line)) {
      flush();
      blocks.push({ type: "rule" });
      continue;
    }
    if (line.includes("|") && TABLE_SEPARATOR.test(lines[at + 1] ?? "")) {
      flush();
      const header = tableCells(line);
      const rows: string[][] = [];
      at++;
      while (at + 1 < lines.length && (lines[at + 1] ?? "").includes("|")) {
        rows.push(tableCells(lines[++at] ?? ""));
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }
    const item = ITEM.exec(line);
    if (item) {
      flush();
      const [, indent = "", bullet = "", check, text = ""] = item;
      const marker = check
        ? `[${check.toLowerCase()}]`
        : /\d/.test(bullet)
          ? bullet.replace(")", ".")
          : "•";
      blocks.push({
        type: "item",
        marker,
        depth: Math.floor(indent.replace(/\t/g, "  ").length / 2),
        text: plainInline(text),
      });
      continue;
    }
    if (/^\s*>/.test(line)) {
      flush();
      const quote = [line.replace(/^\s*>\s?/, "")];
      while (/^\s*>/.test(lines[at + 1] ?? "")) {
        quote.push((lines[++at] ?? "").replace(/^\s*>\s?/, ""));
      }
      blocks.push({ type: "quote", text: plainInline(quote.join(" ")) });
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}
