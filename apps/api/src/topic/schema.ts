import { DOCUMENT_KINDS, TOPIC_SCOPES } from "../database/schema";
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

export const topicReadQuery = z.object({
  topic: name.openapi({
    description: "A topic's id, its name, or a sentence that names it.",
  }),
});
const topicHead = {
  id: z.string(),
  name: z.string(),
  parentName: z.string().nullable().openapi({
    description: "Team or project name. Null for a workspace topic.",
  }),
  deciderName: z.string().nullable(),
};
export const topicCurrentSchema = z
  .object({
    topics: z.array(
      z.object({
        ...topicHead,
        unreviewed: z.number().openapi({
          description:
            "How many documents wait for a decision on this topic. None of them is approved.",
        }),
        current: z
          .object({
            id: z.string(),
            title: z.string(),
            approvedAt: responseTimestamp.nullable(),
            approvedByName: z.string().nullable(),
            reason: z.string().nullable().openapi({
              description: "Why the decider made this document current.",
            }),
            editedSinceApproval: z.boolean().openapi({
              description:
                "The document was edited after it was approved. `text` is still what was approved.",
            }),
            text: z.string().nullable().openapi({
              description:
                "The approved text as it is stored. Null when more than one topic matches: ask again with one topic's id. Also null when the approved text was not kept.",
            }),
          })
          .nullable()
          .openapi({
            description:
              "The topic's current document. Null when nothing is approved on the topic.",
          }),
      }),
    ),
  })
  .openapi("TopicCurrent");
export const topicUnreviewedSchema = z
  .object({
    topics: z.array(
      z.object({
        ...topicHead,
        documents: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            kind: z.enum(DOCUMENT_KINDS),
            creatorName: z.string().nullable(),
            filedAt: responseTimestamp.nullable(),
            updatedAt: responseTimestamp,
          }),
        ),
      }),
    ),
  })
  .openapi("TopicUnreviewed");
