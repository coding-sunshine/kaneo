import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import db from "../database";
import { favoriteTable } from "../database/schema";
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
    "The signed-in user's favorite teams, views, documents and pull requests, oldest first. A pull request's targetId is owner/repo#number.",
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
    "Favorite a team, view, document or pull request. Repeating the call is a no-op.",
  middleware: [...middleware] as const,
  request: { params, body: json(favoriteBody) },
  responses: {
    200: jsonResponse("Favorite saved", favoriteBody),
    403: noAccess,
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
            eq(favoriteTable.userId, c.get("userId")),
            eq(favoriteTable.workspaceId, workspaceId),
          ),
        )
        .orderBy(asc(favoriteTable.createdAt)),
      200,
    );
  })
  .openapi(addRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const data = c.req.valid("json");
    await db
      .insert(favoriteTable)
      .values({ ...data, workspaceId, userId: c.get("userId") })
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
