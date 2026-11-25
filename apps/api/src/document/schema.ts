import { brand } from "@kaneo/brand";
import {
  DOCUMENT_ACCESS,
  DOCUMENT_KINDS,
  DOCUMENT_LINEAGE_STATUSES,
  DOCUMENT_SCOPES,
  DOCUMENT_SOURCE_CLIENTS,
  DOCUMENT_STATUSES,
} from "../database/schema";
import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

const access = z.enum(DOCUMENT_ACCESS);
const role = z.enum(["owner", ...DOCUMENT_ACCESS]);

export const workspaceIdParam = z.object({ workspaceId: z.string() });
export const documentParam = z.object({
  workspaceId: z.string(),
  id: z.string(),
});
export const documentUserParam = documentParam.extend({ userId: z.string() });
export const documentVersionParam = documentParam.extend({
  versionId: z.string(),
});
export const documentCommentParam = documentParam.extend({
  commentId: z.string(),
});

export const listDocumentsQuery = z.object({
  filter: z
    .enum(["recent", "mine", "shared", "unfiled", "inbox", "new"])
    .optional()
    .openapi({
      description:
        "recent: documents you own, edited or were shared. mine: documents you own. shared: documents shared with you directly. unfiled: private drafts with no topic. inbox: documents in a shared place with no topic. new: proposals and current documents on topics you follow, since your last visit.",
    }),
  projectId: z.string().optional().openapi({ description: "Team documents" }),
  workProjectId: z.string().optional(),
  taskId: z.string().optional(),
  topicId: z.string().optional().openapi({
    description: "Documents filed on a topic you can open.",
  }),
});

const parent = {
  projectId: z
    .string()
    .nullable()
    .optional()
    .openapi({
      description: `Team (${brand.name} project) to keep the document in.`,
    }),
  workProjectId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
};

export const createDocumentBody = z.object({
  workspaceId: z.string(),
  title: z.string().max(500).optional(),
  content: z.string().max(1_000_000).optional(),
  icon: z.string().max(100).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  ...parent,
});

export const updateDocumentBody = z.object({
  title: z.string().max(500).optional(),
  content: z.string().max(1_000_000).optional(),
  icon: z.string().max(100).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  generalAccess: access.optional().openapi({
    description: "What everyone who can see the parent may do.",
  }),
  kind: z.enum(DOCUMENT_KINDS).optional().openapi({
    description: "What the document is for. The status is not set by editing.",
  }),
});

export const saveDraftBody = z.object({
  workspaceId: z.string(),
  title: z.string().trim().min(1).max(500),
  markdown: z.string().min(1).max(1_000_000).openapi({
    description: "The whole text as Markdown. It is stored as sent.",
  }),
  idempotencyKey: z.string().min(1).max(200).openapi({
    description:
      "A key the caller makes up once per text. A repeated call with the same key answers with the first draft and saves nothing.",
  }),
  sourceClient: z
    .enum(DOCUMENT_SOURCE_CLIENTS)
    .exclude(["web"])
    .optional()
    .openapi({
      description:
        "The assistant that sends the text. The assistant names itself and nothing checks it.",
    }),
});

export const DOCUMENT_SETTLE_CHOICES = [
  "replace",
  "proposal",
  "brainstorm",
  "discard",
] as const;

export const settleDocumentBody = z.object({
  choice: z.enum(DOCUMENT_SETTLE_CHOICES).openapi({
    description:
      "replace: file it on the topic as a proposal that means to replace the current document. proposal: file it on the topic. brainstorm: keep it private as a brainstorm. discard: move it to trash.",
  }),
  topicId: z.string().optional().openapi({
    description: "The topic to file it on. Needed for replace and proposal.",
  }),
});

export const moveDocumentBody = z.object({
  scope: z.enum(DOCUMENT_SCOPES),
  ...parent,
});

export const shareBody = z.object({ access });

export const audienceQuery = z.object({
  scope: z.enum(DOCUMENT_SCOPES).optional().openapi({
    description:
      "With any of these: also return who could open the document after a move to that place.",
  }),
  projectId: z.string().optional().openapi({ description: "Team" }),
  workProjectId: z.string().optional(),
  taskId: z.string().optional(),
});

export const subscribersBody = z.object({
  userIds: z.array(z.string()).max(500),
});
export const subscribersSchema = z.object({
  subscriberIds: z.array(z.string()),
});

export const createCommentBody = z.object({
  content: z.string().trim().min(1).max(100_000),
  parentId: z.string().nullable().optional(),
  quotedText: z.string().max(5000).nullable().optional(),
});

export const updateCommentBody = z.object({
  content: z.string().trim().min(1).max(100_000).optional(),
  resolved: z.boolean().optional(),
});

const person = {
  creatorId: z.string().nullable(),
  creatorName: z.string().nullable(),
  creatorImage: z.string().nullable(),
};

const documentFields = {
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  scope: z.enum(DOCUMENT_SCOPES),
  projectId: z.string().nullable(),
  workProjectId: z.string().nullable(),
  taskId: z.string().nullable(),
  parentName: z.string().nullable().openapi({
    description: "Team name, project name or issue key of the parent.",
  }),
  kind: z.enum(DOCUMENT_KINDS),
  status: z.enum(DOCUMENT_STATUSES),
  sourceClient: z.enum(DOCUMENT_SOURCE_CLIENTS).nullable().openapi({
    description: "The assistant the document was saved from, if any.",
  }),
  topicId: z.string().nullable().openapi({
    description:
      "The topic the document is filed on. Null when you cannot open the topic.",
  }),
  filedAt: nullableResponseTimestamp,
  approvedAt: nullableResponseTimestamp,
  ...person,
  createdAt: responseTimestamp,
  updatedAt: responseTimestamp,
};

const snoozedUntil = nullableResponseTimestamp.openapi({
  description:
    "The Inbox hides the document until this time. Null when it is not set aside.",
});

export const documentSummarySchema = z
  .object({ ...documentFields, snoozedUntil })
  .openapi("DocumentSummary");

export const snoozeDocumentBody = z.object({
  until: z.string().datetime().nullable().openapi({
    description: "Set the document aside until this time. Null brings it back.",
  }),
});

export const markDocumentsSeenBody = z.object({
  until: z.string().datetime().openapi({
    description:
      "The time of the newest change the page showed. Later changes stay new.",
  }),
});

export const documentsSeenSchema = z
  .object({ seenAt: nullableResponseTimestamp })
  .openapi("DocumentsSeen");

export const documentSnoozeSchema = z
  .object({ id: z.string(), snoozedUntil })
  .openapi("DocumentSnooze");
export const documentListSchema = z.array(documentSummarySchema);

// Never the fingerprint itself, and never a document the reader cannot open.
const revisionOf = z
  .object({
    id: z.string(),
    title: z.string(),
    overlap: z.number().int().openapi({
      description:
        "How much of the two texts is the same, in percent of all five-word runs.",
    }),
    status: z.enum(DOCUMENT_LINEAGE_STATUSES).openapi({
      description:
        "proposed until a person confirms or dismisses the link. It is a hint and changes no status.",
    }),
  })
  .nullable()
  .openapi({
    description:
      "The older document this text looks like a revision of. Null when there is none the reader can open.",
  });

export const decideLineageBody = z.object({
  status: z.enum(["confirmed", "dismissed"]).openapi({
    description: "Whether the document is a revision of the one proposed.",
  }),
});

export const documentSchema = z
  .object({
    ...documentFields,
    content: z.string(),
    contentHash: z.string().openapi({
      description: "SHA-256 of the content in UTF-8, as hex.",
    }),
    topicName: z.string().nullable(),
    supersedesDocumentId: z.string().nullable().openapi({
      description:
        "The document that was current on the topic before this one. On a proposal, the current document its author means it to replace.",
    }),
    statusReason: z.string().nullable().openapi({
      description: "The reason given when the document was made current.",
    }),
    approvedById: z.string().nullable(),
    approvedByName: z.string().nullable(),
    approvedHash: z.string().nullable().openapi({
      description:
        "The contentHash that was approved. It differs once the text is edited.",
    }),
    approvedVersionId: z.string().nullable().openapi({
      description: "The history entry that keeps the approved text.",
    }),
    confirmedAt: nullableResponseTimestamp,
    generalAccess: access,
    updatedById: z.string().nullable(),
    updatedByName: z.string().nullable(),
    role,
    revisionOf,
    shares: z.array(
      z.object({
        userId: z.string(),
        name: z.string(),
        image: z.string().nullable(),
        access,
      }),
    ),
    subscriberIds: z.array(z.string()),
  })
  .openapi("Document");

export const documentVersionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    authorId: z.string().nullable(),
    authorName: z.string().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("DocumentVersion");
export const documentVersionListSchema = z.array(documentVersionSchema);

export const documentCommentSchema = z
  .object({
    id: z.string(),
    documentId: z.string(),
    parentId: z.string().nullable(),
    userId: z.string().nullable(),
    userName: z.string().nullable(),
    userImage: z.string().nullable(),
    content: z.string(),
    quotedText: z.string().nullable(),
    resolvedAt: nullableResponseTimestamp,
    resolvedById: z.string().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("DocumentComment");
export const documentCommentListSchema = z.array(documentCommentSchema);

const audiencePerson = z.object({
  userId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
});
export const documentAudienceSchema = z
  .object({
    current: z.array(audiencePerson).openapi({
      description: "Workspace members who can open the document now.",
    }),
    proposed: z.array(audiencePerson).nullable().openapi({
      description:
        "Members who could open it in the place asked about. Null when no place was asked about.",
    }),
  })
  .openapi("DocumentAudience");

export const idSchema = z.object({ id: z.string() });

export const handOverBody = z.object({
  fromUserId: z.string().openapi({
    description: "The person who left the workspace.",
  }),
  toUserId: z.string().openapi({
    description:
      "The member who becomes the author of their private documents.",
  }),
});
export const handedOverSchema = z
  .object({ moved: z.number().int() })
  .openapi("DocumentsHandedOver");
export const ownerlessDocumentListSchema = z.array(
  z
    .object({
      id: z.string(),
      title: z.string(),
      updatedAt: responseTimestamp,
    })
    .openapi("OwnerlessDocument"),
);

export const savedDraftSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    characters: z.number().int().openapi({
      description: "How long the stored text is. The text is not sent back.",
    }),
    kind: z.enum(DOCUMENT_KINDS),
    status: z.enum(DOCUMENT_STATUSES),
    scope: z.enum(DOCUMENT_SCOPES),
    created: z.boolean().openapi({
      description: "False when the key was used before and nothing was saved.",
    }),
    needsDecision: z.boolean().openapi({
      description:
        "True while the author has not said what the draft is. Ask them, then settle it.",
    }),
    topics: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          parentName: z.string().nullable(),
          currentDocument: z
            .object({
              id: z.string(),
              title: z.string(),
              approvedAt: nullableResponseTimestamp,
            })
            .nullable(),
        }),
      )
      .openapi({
        description:
          "Topics the author can open whose name matches the title, each with its current document.",
      }),
    revisionOf,
  })
  .openapi("SavedDraft");

export const settledDocumentSchema = z
  .object({
    id: z.string(),
    choice: z.enum(DOCUMENT_SETTLE_CHOICES),
    title: z.string(),
    kind: z.enum(DOCUMENT_KINDS),
    status: z.enum(DOCUMENT_STATUSES),
    scope: z.enum(DOCUMENT_SCOPES),
    topicId: z.string().nullable(),
    replacesDocumentId: z.string().nullable().openapi({
      description:
        "The current document the author means this one to replace. It stays current until the topic's decider approves this one.",
    }),
    discarded: z.boolean(),
  })
  .openapi("SettledDocument");
