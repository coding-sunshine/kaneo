import { and, asc, eq, ne, or, sql } from "drizzle-orm";
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
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";

const tags = ["Favorites"];
const params = z.object({ workspaceId: z.string() });
const favoriteBody = z.object({
  type: z.enum(["project", "view", "document", "pullRequest"]),
  targetId: z.string().min(1),
});
const favoriteSchema = favoriteBody.extend({ id: z.string() });
const middleware = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ project: ["read"] }),
] as const;
const noAccess = errorResponse("Missing permission for this workspace");

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
        creatorId: sql`favorite_document.creator_id`,
        scope: sql`favorite_document.scope`,
        projectId: sql`favorite_document.project_id`,
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
    "The signed-in user's favorite teams, views, documents and pull requests, oldest first. A document the user can no longer open is left out. A pull request's targetId is owner/repo#number.",
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
    "Favorite a team, view, document or pull request. Repeating the call is a no-op. A document the user cannot open is refused like one that does not exist.",
  middleware: [...middleware] as const,
  request: { params, body: json(favoriteBody) },
  responses: {
    200: jsonResponse("Favorite saved", favoriteBody),
    403: noAccess,
    404: errorResponse("Document not found"),
  },
});

const removeRoute = createRoute({
  method: "delete",
  operationId: "removeFavorite",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "Remove favorite",
  description: "Unfavorite a team, view, document or pull request.",
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
              ne(favoriteTable.type, "document"),
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
    if (data.type === "document") {
      await loadDocument(workspaceId, data.targetId, userId);
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
