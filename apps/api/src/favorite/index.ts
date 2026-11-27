import { and, asc, eq, notInArray, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import db from "../database";
import { favoriteTable } from "../database/schema";
import { loadDocument } from "../document/controllers/load-document";
import { documentVisibility } from "../document/visibility";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { findAccessibleProjects } from "../project-access/find-accessible-projects";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";

const tags = ["Favorites"];
const params = z.object({ workspaceId: z.string() });
const favoriteBody = z.object({
  type: z.enum(["project", "view", "document", "pullRequest", "documentPin"]),
  targetId: z.string().min(1),
});
const favoriteSchema = favoriteBody.extend({ id: z.string() });
const middleware = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ project: ["read"] }),
] as const;
const noAccess = errorResponse("Missing permission for this workspace");

// A pin on the Documents page is a favorite of its own type, so a document can
// be starred and pinned apart. Both point at a document.
const documentTypes = ["document", "documentPin"] as const;
const isDocument = (type: string) =>
  (documentTypes as readonly string[]).includes(type);

// A favorite can outlive the access that allowed it. The list keeps a
// document only while the user can still open it.
const openDocument = (userId: string, workspaceId: string) =>
  sql<boolean>`EXISTS (
    SELECT 1 FROM document AS favorite_document
    WHERE favorite_document.id = ${favoriteTable.targetId}
      AND favorite_document.workspace_id = ${workspaceId}
      AND favorite_document.deleted_at IS NULL
      AND ${documentVisibility(userId, {
        id: sql`favorite_document.id`,
        workspaceId: sql`favorite_document.workspace_id`,
        creatorId: sql`favorite_document.creator_id`,
        scope: sql`favorite_document.scope`,
        projectId: sql`favorite_document.project_id`,
        workProjectId: sql`favorite_document.work_project_id`,
        taskId: sql`favorite_document.task_id`,
      })}
  )`;
const json = <T extends z.ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});

const listRoute = createRoute({
  method: "get",
  operationId: "listFavorites",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List favorites",
  description:
    "The signed-in user's favorite teams, views, documents and pull requests, and the documents they pinned on the Documents page (type documentPin), oldest first. A document the user can no longer open is left out. A pull request's targetId is owner/repo#number.",
  middleware: [...middleware] as const,
  request: { params },
  responses: {
    200: jsonResponse("Favorites", z.array(favoriteSchema)),
    403: noAccess,
  },
});

const addRoute = createRoute({
  method: "put",
  operationId: "addFavorite",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "Add favorite",
  description:
    "Favorite a team, view, document or pull request, or pin a document (documentPin). Repeating the call is a no-op. A team or document the user cannot open is refused like one that does not exist.",
  middleware: [...middleware] as const,
  request: { params, body: json(favoriteBody) },
  responses: {
    200: jsonResponse("Favorite saved", favoriteBody),
    403: noAccess,
    404: errorResponse("Team or document not found"),
  },
});

const removeRoute = createRoute({
  method: "delete",
  operationId: "removeFavorite",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "Remove favorite",
  description:
    "Unfavorite a team, view, document or pull request, or unpin a document.",
  middleware: [...middleware] as const,
  request: { params, query: favoriteBody },
  responses: {
    200: jsonResponse("Favorite removed", favoriteBody),
    403: noAccess,
  },
});

const favorite = apiRouter()
  .openapi(listRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const userId = c.get("userId");
    return c.json(
      await db
        .select({
          id: favoriteTable.id,
          type: favoriteTable.type,
          targetId: favoriteTable.targetId,
        })
        .from(favoriteTable)
        .where(
          and(
            eq(favoriteTable.userId, userId),
            eq(favoriteTable.workspaceId, workspaceId),
            or(
              notInArray(favoriteTable.type, [...documentTypes]),
              openDocument(userId, workspaceId),
            ),
          ),
        )
        .orderBy(asc(favoriteTable.createdAt)),
      200,
    );
  })
  .openapi(addRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const data = c.req.valid("json");
    const userId = c.get("userId");
    if (isDocument(data.type)) {
      await loadDocument(workspaceId, data.targetId, userId);
    }
    if (
      data.type === "project" &&
      (await findAccessibleProjects(userId, [data.targetId])).get(
        data.targetId,
      ) !== workspaceId
    ) {
      throw new HTTPException(404, { message: "Team not found" });
    }
    await db
      .insert(favoriteTable)
      .values({ ...data, workspaceId, userId })
      .onConflictDoNothing();
    return c.json(data, 200);
  })
  .openapi(removeRoute, async (c) => {
    const data = c.req.valid("query");
    await db
      .delete(favoriteTable)
      .where(
        and(
          eq(favoriteTable.userId, c.get("userId")),
          eq(favoriteTable.type, data.type),
          eq(favoriteTable.targetId, data.targetId),
        ),
      );
    return c.json(data, 200);
  });

export default favorite;
