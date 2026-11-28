import { dropRawIds } from "../assist/drop-raw-ids";

export const SOURCE_KINDS = ["task", "document", "comment", "message"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export type Cited = { kind: SourceKind; id: string };

/** Told to the model in a chat, so every answer names what it rests on. */
export const SOURCES_INSTRUCTION =
  "End every answer with one last line that starts with `Sources:` and lists the tasks, documents, comments and chat messages the answer rests on, as task:<id>, document:<id>, comment:<id> or message:<id>, separated by spaces. Use the `id` field that appeared in tool results, never a ticket key such as ABC-12. Write `Sources: none` when no workspace data supports the answer.";

// The last line, with any Markdown a model puts around the word.
const LINE = /(?:^|\n)[ \t*_#>-]*sources[*_]*\s*:[^\n]*\s*$/i;
const TOKEN = /\b(task|document|comment|message):\s*`?([A-Za-z0-9_-]+)/g;

/**
 * Splits an answer into its text and the sources its last line names. The
 * text loses the ids it wrote inline: the sources show under it as links.
 */
export function splitSources(content: string): {
  text: string;
  cited: Cited[];
} {
  const line = content.match(LINE);
  if (!line) return { text: dropRawIds(content, []), cited: [] };
  const seen = new Set<string>();
  const cited: Cited[] = [];
  for (const [, kind, id] of line[0].matchAll(TOKEN)) {
    const key = `${kind}:${id}`;
    if (!id || seen.has(key)) continue;
    seen.add(key);
    cited.push({ kind: kind as SourceKind, id });
  }
  return {
    text: dropRawIds(
      content.slice(0, line.index),
      cited.map(({ id }) => id),
    ),
    cited,
  };
}

/**
 * Keeps the sources whose id came back whole in a tool result of the same
 * turn: an id the model never read, or only part of a longer one, is not a
 * source.
 */
export function grounded(cited: Cited[], toolResults: string[]) {
  const returned = new Set(
    toolResults.flatMap((result) => result.match(/[A-Za-z0-9_-]+/g) ?? []),
  );
  return cited.filter(({ id }) => returned.has(id));
}
