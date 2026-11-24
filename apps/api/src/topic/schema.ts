import { TOPIC_SCOPES } from "../database/schema";
import { responseTimestamp, z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });
export const topicParam = z.object({
  workspaceId: z.string(),
  id: z.string(),
});
export const topicDocumentParam = topicParam.extend({
  documentId: z.string(),
});

const name = z.string().trim().min(1).max(200);
const backupDeciderId = z.string().nullable().optional().openapi({
  description: "A second person who can approve when the decider is away.",
});

export const createTopicBody = z.object({
  workspaceId: z.string(),
  name,
  scope: z.enum(TOPIC_SCOPES).optional().openapi({
    description:
      "Where the topic lives. Defaults to the team or project given, else the workspace.",
  }),
  projectId: z.string().optional().openapi({ description: "Team" }),
  workProjectId: z.string().optional(),
  deciderId: z.string().optional().openapi({
    description: "Defaults to the person creating the topic.",
  }),
  backupDeciderId,
});

export const updateTopicBody = z.object({
  name: name.optional(),
  deciderId: z.string().optional(),
  backupDeciderId,
});

export const makeCurrentBody = z.object({
  reason: z.string().trim().min(1).max(2000).openapi({
    description: "Why this document is the one to rely on.",
  }),
});

export const topicSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    scope: z.enum(TOPIC_SCOPES),
    projectId: z.string().nullable(),
    workProjectId: z.string().nullable(),
    parentName: z.string().nullable().openapi({
      description: "Team or project name. Null for a workspace topic.",
    }),
    deciderId: z.string().nullable(),
    deciderName: z.string().nullable(),
    deciderImage: z.string().nullable(),
    backupDeciderId: z.string().nullable(),
    backupDeciderName: z.string().nullable(),
    backupDeciderImage: z.string().nullable(),
    currentDocumentId: z.string().nullable(),
    canDecide: z.boolean().openapi({
      description:
        "Whether you can make a document current here: the decider, the backup decider or a workspace owner.",
    }),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("Topic");
export const topicListSchema = z.array(topicSchema);
