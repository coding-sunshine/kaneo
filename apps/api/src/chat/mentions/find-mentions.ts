import {
  findDocumentIds,
  findProjectIds,
  findTaskReferences,
} from "../../task-document/find-links";
import { parseMentionIds } from "../../utils/parse-mentions";

export type MentionRefs = {
  userIds: string[];
  taskKeys: { key: string; number: number }[];
  documentIds: string[];
  projectIds: string[];
};

/**
 * What a message names: people by their mention tag, tickets by a typed key,
 * documents and teams by their address in this workspace. No lookup.
 */
export function findMentions(body: string, workspaceId: string): MentionRefs {
  return {
    userIds: parseMentionIds(body),
    taskKeys: findTaskReferences(body).keys,
    documentIds: findDocumentIds(body, workspaceId),
    projectIds: findProjectIds(body, workspaceId),
  };
}

/** How a card names a typed ticket key, whatever case it was typed in. */
export const taskRef = (key: string, number: number) =>
  `${key.normalize("NFKC").toUpperCase()}-${number}`;
