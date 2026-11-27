/** A source an answer rests on, as the API resolved it for the reader. */
export type AgentCitation =
  | {
      kind: "task" | "document" | "comment";
      restricted: false;
      id: string;
      title: string;
      taskId?: string;
      projectId?: string;
      ticket?: string;
    }
  | { kind: "task" | "document" | "comment"; restricted: true };
