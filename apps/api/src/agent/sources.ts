export const SOURCE_KINDS = ["task", "document", "comment"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export type Cited = { kind: SourceKind; id: string };

/** Told to the model in a chat, so every answer names what it rests on. */
export const SOURCES_INSTRUCTION =
  "End every answer with one last line that starts with `Sources:` and lists the tasks, documents and comments the answer rests on, as task:<id>, document:<id> or comment:<id>, separated by spaces. Use the `id` field that appeared in tool results, never a ticket key such as ABC-12. Write `Sources: none` when no workspace data supports the answer.";

// The last line, with any Markdown a model puts around the word.
const LINE = /(?:^|\n)[ \t*_#>-]*sources[*_]*\s*:[^\n]*\s*$/i;
const TOKEN = /\b(task|document|comment):\s*`?([A-Za-z0-9_-]+)/g;

/** Splits an answer into its text and the sources its last line names. */
export function splitSources(content: string): {
  text: string;
  cited: Cited[];
} {
  const line = content.match(LINE);
  if (!line) return { text: content, cited: [] };
  const seen = new Set<string>();
  const cited: Cited[] = [];
  for (const [, kind, id] of line[0].matchAll(TOKEN)) {
    const key = `${kind}:${id}`;
    if (!id || seen.has(key)) continue;
    seen.add(key);
    cited.push({ kind: kind as SourceKind, id });
  }
  return { text: content.slice(0, line.index).trimEnd(), cited };
}

/**
 * Keeps the sources whose id came back in a tool result of the same turn: an
 * id the model never read is not a source.
 */
export const grounded = (cited: Cited[], toolResults: string[]) =>
  cited.filter(({ id }) => toolResults.some((result) => result.includes(id)));
