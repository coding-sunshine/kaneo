import { brand } from "@kaneo/brand";
import {
  DOCUMENT_ACCESS,
  DOCUMENT_KINDS,
  DOCUMENT_LINEAGE_STATUSES,
  DOCUMENT_SCOPES,
  DOCUMENT_SOURCE_CLIENTS,
  DOCUMENT_STATUSES,
  SLOT_TYPES,
  STATEMENT_RESULTS,
  STATEMENT_SOURCES,
  STATEMENT_STATUSES,
} from "../database/schema";
import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";
import { slotHeadsSchema } from "../topic/schema";

const access = z.enum(DOCUMENT_ACCESS);
const role = z.enum(["owner", ...DOCUMENT_ACCESS]);

export const workspaceIdParam = z.object({ workspaceId: z.string() });
export const documentParam = z.object({
  workspaceId: z.string(),
  id: z.string(),
});
export const documentUserParam = documentParam.extend({ userId: z.string() });
export const documentTaskParam = documentParam.extend({ taskId: z.string() });
export const documentStatementParam = documentParam.extend({
  statementId: z.string(),
});
export const documentConflictParam = documentParam.extend({
  conflictId: z.string(),
});
export const documentDependencyParam = documentStatementParam.extend({
  dependencyId: z.string(),
});
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
  linkedTaskId: z.string().optional().openapi({
    description:
      "Documents linked with an issue you can open, in the text of either. Empty for an issue you cannot open.",
  }),
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

export const statementBody = z.object({
  slot: z.string().trim().min(1).max(40).openapi({
    description: "The key of a slot of the topic the document is filed on.",
  }),
  value: z.string().trim().min(1).max(200).openapi({
    description: "The fact in a few words, such as a date or an amount.",
  }),
  quote: z.string().trim().min(1).max(400).openapi({
    description:
      "The passage of the document that states the value, copied as it is written: at least 4 characters. A quote that is not in the document is refused.",
  }),
});

export const rejectStatementBody = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const dependencyBody = z
  .object({
    taskId: z.string().min(1).optional().openapi({
      description: "The issue that relies on the value.",
    }),
    documentId: z.string().min(1).optional().openapi({
      description: "The document that relies on the value.",
    }),
  })
  .refine((work) => Boolean(work.taskId) !== Boolean(work.documentId), {
    message: "Send exactly one of taskId and documentId",
  });

export const dependencySchema = z
  .object({
    id: z.string(),
    statementId: z.string(),
    taskId: z.string().nullable(),
    documentId: z.string().nullable(),
    needsReview: z.boolean().openapi({
      description:
        "True from the moment the topic stops stating the value, until someone clears the flag.",
    }),
  })
  .openapi("StatementDependency");

export const decideConflictBody = z.object({
  decision: z.enum(["replace", "keep", "tolerate", "dismiss"]).openapi({
    description:
      "replace: the document's value stands, and its statement is confirmed. keep: the current value stands, and the document's statement is rejected with the reason. tolerate: the two may differ until tolerateUntil. dismiss: the two do not contradict each other, and the document's statement stays as it is.",
  }),
  reason: z.string().trim().min(1).max(500),
  tolerateUntil: z.string().datetime().optional().openapi({
    description: "Needed for tolerate. A time that has not come yet.",
  }),
});

export const settleDocumentBody = z.object({
  choice: z.enum(DOCUMENT_SETTLE_CHOICES).openapi({
    description:
      "replace: file it on the topic as a proposal that means to replace the current document. proposal: file it on the topic. brainstorm: keep it private as a brainstorm. discard: move it to trash.",
  }),
  topicId: z.string().optional().openapi({
    description: "The topic to file it on. Needed for replace and proposal.",
  }),
  statements: z.array(statementBody).max(20).optional().openapi({
    description:
      "For replace and proposal: what the document states for the topic's slots. Each is stored as a proposal that a person confirms.",
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
  projectId: z.string().nullable().openapi({
    description: "The parent team. Null when the viewer cannot open it.",
  }),
  workProjectId: z.string().nullable(),
  taskId: z.string().nullable().openapi({
    description: "The parent issue. Null when the viewer cannot open its team.",
  }),
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
  .object({
    ...documentFields,
    snoozedUntil,
    currentDocumentId: z.string().nullable().openapi({
      description:
        "On a replaced document: the current document of its topic, if you can open it.",
    }),
    replacesDocumentId: z.string().nullable().openapi({
      description:
        "On a proposal: the document its author means it to replace. It may no longer be current. Null when you cannot open the topic.",
    }),
  })
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
    citedBy: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          number: z.number().nullable(),
          projectId: z.string(),
          projectSlug: z.string(),
        }),
      )
      .openapi({
        description:
          "Issues linked with the document, in the text of either. Only issues you can open.",
      }),
    sharedTasks: z
      .array(
        z.object({
          id: z.string(),
          title: z.string().nullable(),
          number: z.number().nullable(),
          projectId: z.string().nullable(),
          projectSlug: z.string().nullable(),
        }),
      )
      .openapi({
        description:
          "Issues the document is shared with: everyone who can open one can view the document. With edit rights you get every issue, without its name when you cannot open it. Otherwise only issues you can open.",
      }),
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

export const documentTaskAudienceSchema = z
  .object({
    total: z.number().openapi({
      description: "Workspace members who can open the issue.",
    }),
    missing: z.number().openapi({
      description: "How many of them cannot open the document.",
    }),
    gains: z.array(audiencePerson).openapi({
      description:
        "The people who cannot open the document. Sharing it with the issue lets them view it.",
    }),
  })
  .openapi("DocumentTaskAudience");

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
export const documentUsageSchema = z
  .object({
    topicsWithCurrent: z.number().int().openapi({
      description: "Topics that have a current document.",
    }),
    weeks: z
      .array(
        z.object({
          from: responseTimestamp,
          to: responseTimestamp,
          added: z.number().int().openapi({
            description:
              "Documents added in the week that are not in the trash.",
          }),
          filed: z.number().int().openapi({
            description:
              "How many of the added documents were filed on a topic.",
          }),
          chatSaves: z.number().int().openapi({
            description: "How many of the added documents an assistant saved.",
          }),
        }),
      )
      .openapi({
        description:
          "The last four weeks, newest first. A week is seven days back from the time of the call.",
      }),
  })
  .openapi("DocumentUsage");
export const ownerlessDocumentListSchema = z.array(
  z
    .object({
      id: z.string(),
      title: z.string(),
      updatedAt: responseTimestamp,
      creatorId: z.string().nullable().openapi({
        description:
          "The author who left. Null when they deleted their account. Hand the documents over with it.",
      }),
      creatorName: z.string().nullable(),
    })
    .openapi("OwnerlessDocument"),
);

export const documentFileUploadBody = z.object({
  filename: z.string().min(1).max(255).openapi({
    description:
      "The file's name. Its extension decides the stored type; a type sent by the caller is never used.",
  }),
  size: z.number().openapi({ description: "Size of the file in bytes." }),
});

export const finalizeDocumentFileUploadBody = documentFileUploadBody.extend({
  key: z
    .string()
    .openapi({ description: "The key returned when the URL was issued." }),
});

export const issueFileParam = z.object({
  workspaceId: z.string(),
  assetId: z.string(),
});
export const issueFilesQuery = z.object({
  topicId: z.string().optional().openapi({
    description: "Only the files of issues on this topic.",
  }),
});
export const issueFileTopic = z.object({
  topicId: z.string().min(1).openapi({
    description: "A topic the file's issue is on.",
  }),
});
export const issueFileListSchema = z.array(
  z
    .object({
      id: z.string(),
      filename: z.string(),
      mimeType: z.string(),
      size: z.number(),
      createdAt: responseTimestamp,
      url: z.string().openapi({
        description:
          "Where the file is read from. It opens for whoever can open the issue.",
      }),
      task: z.object({
        id: z.string(),
        title: z.string(),
        number: z.number().nullable(),
        projectId: z.string(),
        projectSlug: z.string(),
      }),
      topics: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            proposedDocumentId: z.string().nullable().openapi({
              description:
                "The document made from this file on the topic, when you can open one.",
            }),
          }),
        )
        .openapi({
          description: "The topics the issue is on that you can open.",
        }),
    })
    .openapi("IssueFile"),
);

export const documentFileSchema = z
  .object({
    id: z.string(),
    url: z.string().openapi({
      description:
        "Where the file is read back from. It opens for whoever can open the document.",
    }),
    kind: z.string().openapi({
      description: "image for a picture, attachment for any other file.",
    }),
    mimeType: z.string(),
  })
  .openapi("DocumentFile");

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
          slots: slotHeadsSchema,
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
    statements: z
      .array(
        z.object({
          slot: z.string(),
          result: z.enum(STATEMENT_RESULTS).openapi({
            description:
              "added: stored as a proposal. unknown_slot: the topic has no slot with that key. quote_not_found: the quote is not in the document, or is shorter than 4 characters. invalid_value: the value does not fit the slot. exists: the slot already has a statement from this document.",
          }),
          id: z.string().optional(),
        }),
      )
      .openapi({
        description:
          "What happened to each statement sent, in the order sent. A refused statement does not undo the filing.",
      }),
  })
  .openapi("SettledDocument");

export const statementSchema = z
  .object({
    id: z.string(),
    slotId: z.string(),
    slot: z.string().openapi({ description: "The slot's key." }),
    slotName: z.string(),
    type: z.enum(SLOT_TYPES),
    value: z.string(),
    quote: z.string(),
    quoteStart: z.number().int().openapi({
      description:
        "Where the quote starts in the document's text, with tags removed and whitespace collapsed.",
    }),
    status: z.enum(STATEMENT_STATUSES).openapi({
      description:
        "proposed until a person confirms or rejects it. A confirmation is for the text it was given on: after an edit the statement is proposed again.",
    }),
    statusReason: z.string().nullable(),
    source: z.enum(STATEMENT_SOURCES),
    createdAt: responseTimestamp,
    decidedAt: nullableResponseTimestamp,
    decidedByName: z.string().nullable(),
  })
  .openapi("Statement");
export const statementListSchema = z.array(statementSchema);

const statedSchema = z.object({
  statementId: z.string(),
  slotId: z.string(),
  slot: z.string().openapi({ description: "The slot's key." }),
  slotName: z.string(),
  type: z.enum(SLOT_TYPES),
  value: z.string(),
  quote: z.string(),
  confirmed: z.boolean().openapi({
    description:
      "A person confirmed this statement for the document's present text.",
  }),
});
const comparedSchema = statedSchema.extend({
  current: z
    .object({
      statementId: z.string(),
      documentId: z.string(),
      documentTitle: z.string(),
      value: z.string(),
      quote: z.string(),
    })
    .openapi({
      description: "What the topic's current document states for the slot.",
    }),
});
export const conflictSchema = comparedSchema
  .extend({
    id: z.string().openapi({
      description:
        "Names the slot, the two documents and the two values. When a value changes, it is another conflict with another id.",
    }),
    status: z.enum(["open", "tolerated", "resolved"]).openapi({
      description:
        "open: the document cannot be made current. tolerated: the two may differ until tolerateUntil. resolved: the decider said the document's value stands, or that the two do not contradict each other.",
    }),
    reason: z.string().nullable(),
    tolerateUntil: nullableResponseTimestamp,
  })
  .openapi("StatementConflict");
export const receiptSchema = z
  .object({
    repeats: z.array(comparedSchema).openapi({
      description: "Says the same as the topic's current document.",
    }),
    new: z.array(statedSchema).openapi({
      description: "The topic's current document states nothing for the slot.",
    }),
    conflicts: z.array(conflictSchema).openapi({
      description:
        "Says something else than the topic's current document, each with both quotes.",
    }),
    unjudged: z.array(comparedSchema).openapi({
      description:
        "Worded differently from the current document, in a slot that holds free text. Nobody has judged whether the two disagree.",
    }),
    notChecked: z
      .array(
        z.object({
          slot: z.string(),
          slotName: z.string(),
          type: z.enum(SLOT_TYPES),
        }),
      )
      .openapi({
        description: "Slots of the topic the document has no statement for.",
      }),
  })
  .openapi("DocumentReceipt");
