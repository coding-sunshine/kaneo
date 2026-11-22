import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });
export const viewParam = z.object({
  workspaceId: z.string(),
  id: z.string(),
});

const visibility = z.enum(["personal", "shared"]);
const blob = z.record(z.string(), z.unknown());

export const createViewBody = z.object({
  workspaceId: z.string(),
  projectId: z.string().nullable().openapi({
    description:
      "Team (Kaneo project) the view belongs to; null for a workspace view.",
  }),
  visibility: visibility.default("shared").openapi({
    description: "personal: owner only; shared: the team or workspace.",
  }),
  name: z.string().trim().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  filters: blob,
  display: blob,
});

export const updateViewBody = z.object({
  visibility: visibility.optional(),
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  filters: blob.optional(),
  display: blob.optional(),
});

export const savedViewSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    projectId: z.string().nullable(),
    ownerId: z.string().nullable(),
    ownerName: z.string().nullable(),
    visibility,
    canEdit: z.boolean().openapi({ description: "True for the view's owner." }),
    name: z.string(),
    description: z.string().nullable(),
    filters: blob,
    display: blob,
    createdAt: responseTimestamp,
    updatedAt: nullableResponseTimestamp,
  })
  .openapi("SavedView");

export const savedViewListSchema = z.array(savedViewSchema);
export const deletedViewSchema = z.object({ id: z.string() });
