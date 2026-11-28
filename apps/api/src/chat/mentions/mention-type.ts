export type MessageMention = {
  kind: "user" | "task" | "document" | "project";
  /** How the text names it: a user, document or team id, or a ticket key. */
  ref: string;
  /** Null, like title and status, when the reader cannot open it. */
  id: string | null;
  title: string | null;
  status: string | null;
  /** The team of a ticket the reader can open. */
  projectId: string | null;
  restricted: boolean;
};
