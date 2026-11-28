import { TRIAGE_FIELDS, TRIAGE_TOOL } from "../triage/triage-tool";

type Row = {
  tool: string;
  arguments: Record<string, unknown>;
  diff: { field: string; from: string | null; to: string | null }[];
};

/** Whether a person may keep some of the proposal's fields and drop others. */
export const isSelectable = (tool: string) => tool === TRIAGE_TOOL;

/**
 * The proposal cut down to the fields the person kept: the arguments that set
 * a dropped field are removed, so accepting runs only what stays on the card.
 * `fields` undefined keeps everything.
 */
export function keepFields<T extends Row>(row: T, fields?: string[]): T {
  if (!fields || !isSelectable(row.tool)) return row;
  const kept = new Set(fields);
  const args = { ...row.arguments };
  for (const [field, arg] of Object.entries(TRIAGE_FIELDS)) {
    if (!kept.has(field)) delete args[arg];
  }
  return {
    ...row,
    arguments: args,
    diff: row.diff.filter((change) => kept.has(change.field)),
  };
}
