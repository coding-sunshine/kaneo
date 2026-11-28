export type MessageBlock =
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string; code: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; blocks: MessageBlock[] };

export type InlineNode =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong"; children: InlineNode[] };

const FENCE = /^```([\w+#.-]*)\s*$/;
const BULLET = /^[-*+] (.*)$/;
const NUMBERED = /^\d{1,9}[.)] (.*)$/;
const QUOTE = /^> ?(.*)$/;

/**
 * Splits message text into the block syntax chat supports: fenced code,
 * lists, quotes and paragraphs. Anything else stays paragraph text.
 */
export function parseBlocks(text: string): MessageBlock[] {
  const lines = text.split("\n");
  const blocks: MessageBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    }
    paragraph = [];
  };
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    const fence = FENCE.exec(line);
    const close = fence
      ? lines.findIndex((next, at) => at > index && next.trim() === "```")
      : -1;
    if (fence && close > index) {
      flush();
      blocks.push({
        type: "code",
        language: fence[1] ?? "",
        code: lines.slice(index + 1, close).join("\n"),
      });
      index = close + 1;
      continue;
    }
    const run = (pattern: RegExp) => {
      const items: string[] = [];
      while (index < lines.length) {
        const match = pattern.exec(lines[index] ?? "");
        if (!match) break;
        items.push(match[1] ?? "");
        index += 1;
      }
      return items;
    };
    if (QUOTE.test(line)) {
      flush();
      blocks.push({
        type: "quote",
        blocks: parseBlocks(run(QUOTE).join("\n")),
      });
    } else if (BULLET.test(line) || NUMBERED.test(line)) {
      flush();
      const ordered = NUMBERED.test(line);
      blocks.push({
        type: "list",
        ordered,
        items: run(ordered ? NUMBERED : BULLET),
      });
    } else {
      if (line.trim()) paragraph.push(line);
      else flush();
      index += 1;
    }
  }
  flush();
  return blocks;
}

// A mention tag or a link passes through whole, so markers inside it stay text.
const INLINE =
  /(<kaneo-mention[^>]*>(?:<\/kaneo-mention>)?|\bhttps?:\/\/[^\s<>"'`]+)|`([^`\n]+)`|\*\*(?!\s)(.+?)(?<!\s)\*\*/gu;

/** Splits a run of text into plain text, `code` and **bold**. */
export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const pushText = (value: string) => {
    if (!value) return;
    const last = nodes.at(-1);
    if (last?.type === "text") last.text += value;
    else nodes.push({ type: "text", text: value });
  };
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    pushText(text.slice(last, match.index));
    if (match[1] !== undefined) pushText(match[1]);
    else if (match[2] !== undefined)
      nodes.push({ type: "code", text: match[2] });
    else nodes.push({ type: "strong", children: parseInline(match[3] ?? "") });
    last = match.index + match[0].length;
  }
  pushText(text.slice(last));
  return nodes;
}
