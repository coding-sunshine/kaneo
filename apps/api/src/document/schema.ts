import { brand } from "@kaneo/brand";
import { DOCUMENT_ACCESS, DOCUMENT_SCOPES } from "../database/schema";
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
  filter: z.enum(["recent", "mine", "shared"]).optional().openapi({
    description:
      "recent: documents you own, edited or were shared. mine: documents you own. shared: documents shared with you directly.",
  }),
  projectId: z.string().optional().openapi({ description: "Team documents" }),
  workProjectId: z.string().optional(),
  taskId: z.string().optional(),
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
});

export const moveDocumentBody = z.object({
  scope: z.enum(DOCUMENT_SCOPES),
  ...parent,
});

export const shareBody = z.object({ access });

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
  ...person,
  createdAt: responseTimestamp,
  updatedAt: responseTimestamp,
};

export const documentSummarySchema = z
  .object(documentFields)
  .openapi("DocumentSummary");
export const documentListSchema = z.array(documentSummarySchema);

export const documentSchema = z
  .object({
    ...documentFields,
    content: z.string(),
    generalAccess: access,
    updatedById: z.string().nullable(),
    updatedByName: z.string().nullable(),
    role,
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

export const idSchema = z.object({ id: z.string() });
