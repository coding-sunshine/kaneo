const HEADING = "## Decisions";
const isHeading = (line: string) => /^#{1,6}\s+decisions\s*$/i.test(line);
const isListItem = (line: string) => /^[-*+]\s/.test(line);

// Puts a decision at the top of the document's "Decisions" list, newest
// first. A document without that heading gets it above everything else.
export function addDecisionLine(content: string, line: string) {
  const lines = content.split("\n");
  const at = lines.findIndex(isHeading);
  if (at === -1) {
    return [HEADING, "", line, ...(content.trim() ? ["", content] : [])].join(
      "\n",
    );
  }
  let next = at + 1;
  while (next < lines.length && lines[next]?.trim() === "") next += 1;
  const rest = lines.slice(next);
  // The line joins a list that is already there. Other text keeps its gap.
  const gap = rest.length > 0 && !isListItem(rest[0] ?? "") ? [""] : [];
  return [...lines.slice(0, at + 1), "", line, ...gap, ...rest].join("\n");
}

// The items of the document's "Decisions" list, up to the next heading.
export function decisionLines(content: string) {
  const lines = content.split("\n");
  const at = lines.findIndex(isHeading);
  if (at === -1) return [];
  const end = lines.findIndex((line, i) => i > at && /^#{1,6}\s/.test(line));
  return lines
    .slice(at + 1, end === -1 ? undefined : end)
    .filter(isListItem)
    .map((line) => line.trim());
}
