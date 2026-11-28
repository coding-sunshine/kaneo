type Kind = "task" | "document" | "comment" | "message";

/** A source an answer rests on, as the API resolved it for the reader. */
export type AgentCitation =
  | {
      kind: Kind;
      restricted: false;
      id: string;
      title: string;
      taskId?: string;
      projectId?: string;
      ticket?: string;
      /** The channel a chat message is in. */
      channelId?: string;
    }
  | { kind: Kind; restricted: true };
