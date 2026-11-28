export type MentionPick =
  | { type: "person"; userId: string }
  | { type: "task"; projectSlug: string; taskNumber: number }
  | { type: "document"; id: string }
  | { type: "project"; id: string };

/**
 * What the picker writes into a message: a person's mention tag, a ticket's
 * key, or the address of a document or team. The server reads them back.
 */
export function mentionToken(
  pick: MentionPick,
  workspaceId: string,
  origin: string,
) {
  const base = `${origin}/dashboard/workspace/${workspaceId}`;
  switch (pick.type) {
    case "person":
      return `<kaneo-mention id="${pick.userId}"></kaneo-mention>`;
    case "task":
      return `${pick.projectSlug.toUpperCase()}-${pick.taskNumber}`;
    case "document":
      return `${base}/document/${pick.id}`;
    case "project":
      return `${base}/project/${pick.id}/board`;
  }
}
