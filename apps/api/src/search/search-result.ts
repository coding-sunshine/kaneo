import type { DocumentScope } from "../database/schema";

export type SearchResult = {
  id: string;
  type:
    | "task"
    | "project"
    | "workspace"
    | "comment"
    | "activity"
    | "document"
    | "message"
    | "person";
  title: string;
  description?: string;
  content?: string;
  projectId?: string;
  projectName?: string;
  workspaceId?: string;
  workspaceName?: string;
  userId?: string;
  userName?: string;
  createdAt: Date;
  relevanceScore: number;
  taskId?: string;
  taskNumber?: number;
  projectSlug?: string;
  priority?: string;
  status?: string;
  topicName?: string;
  scope?: DocumentScope;
  parentName?: string | null;
  archivedAt?: Date | null;
  channelId?: string;
  isDirect?: boolean;
};
