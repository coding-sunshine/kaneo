import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { getPrivateObject } from "../storage/s3";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { createEmoji, prepareEmojiUpload } from "./controllers/create-emoji";
import deleteEmoji from "./controllers/delete-emoji";
import { findEmoji, listEmoji } from "./controllers/emoji-queries";
import { emojiListSchema, emojiSchema, emojiUploadSchema } from "./response";
import {
  createEmojiBody,
  emojiParam,
  prepareEmojiUploadBody,
  workspaceIdParam,
} from "./schema";

const listEmojiRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceEmoji",
  path: "/workspace/{workspaceId}",
  tags: ["Emoji"],
  summary: "List custom emoji",
  description: "The workspace's custom emoji, newest first.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ workspace: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Custom emoji", emojiListSchema),
    403: errorResponse("Missing workspace:read permission"),
    404: errorResponse("Workspace not found"),
  },
});

const prepareUploadRoute = createRoute({
  method: "post",
  operationId: "prepareWorkspaceEmojiUpload",
  path: "/workspace/{workspaceId}/upload",
  tags: ["Emoji"],
  summary: "Prepare custom emoji upload",
  description:
    "Create a presigned upload URL for a PNG, JPEG, GIF or WebP image of at most 500 KB. Fails if the name is taken.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: workspaceIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: prepareEmojiUploadBody } },
    },
  },
  responses: {
    200: jsonResponse("Upload URL", emojiUploadSchema),
    400: errorResponse("Invalid name, type or size"),
    403: errorResponse("Missing task:update permission"),
    409: errorResponse("An emoji with this name already exists"),
    503: errorResponse("Image uploads are not configured"),
  },
});

const createEmojiRoute = createRoute({
  method: "post",
  operationId: "createWorkspaceEmoji",
  path: "/workspace/{workspaceId}",
  tags: ["Emoji"],
  summary: "Create custom emoji",
  description:
    "Save an uploaded image as a custom emoji. The stored object must match the declared type and size.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: workspaceIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createEmojiBody } },
    },
  },
  responses: {
    200: jsonResponse("The created emoji", emojiSchema),
    400: errorResponse("Invalid body, key or uploaded object"),
    403: errorResponse("Missing task:update permission"),
    409: errorResponse("An emoji with this name already exists"),
    503: errorResponse("Unable to verify the upload"),
  },
});

const deleteEmojiRoute = createRoute({
  method: "delete",
  operationId: "deleteWorkspaceEmoji",
  path: "/workspace/{workspaceId}/{emojiId}",
  tags: ["Emoji"],
  summary: "Delete custom emoji",
  description:
    "Remove a custom emoji. Existing reactions keep their :name: text.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: emojiParam },
  responses: {
    204: { description: "Emoji deleted" },
    403: errorResponse("Missing workspace:manage_settings permission"),
    404: errorResponse("Emoji not found"),
  },
});

const getEmojiImageRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceEmojiImage",
  path: "/workspace/{workspaceId}/{emojiId}/image",
  tags: ["Emoji"],
  summary: "Download custom emoji image",
  description: "Download a custom emoji's image.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ workspace: ["read"] }),
  ] as const,
  request: { params: emojiParam },
  responses: {
    200: {
      description: "The emoji image",
      content: { "image/*": { schema: { type: "string", format: "binary" } } },
    },
    403: errorResponse("Missing workspace:read permission"),
    404: errorResponse("Emoji not found"),
  },
});

const emoji = apiRouter()
  .openapi(listEmojiRoute, async (c) =>
    c.json(await listEmoji(c.req.valid("param").workspaceId, c.req.url), 200),
  )
  .openapi(prepareUploadRoute, async (c) =>
    c.json(
      await prepareEmojiUpload(
        c.req.valid("param").workspaceId,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(createEmojiRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const created = await createEmoji(
      workspaceId,
      c.get("userId"),
      c.req.url,
      c.req.valid("json"),
    );
    return c.json(created, 200);
  })
  .openapi(deleteEmojiRoute, async (c) => {
    const { workspaceId, emojiId } = c.req.valid("param");
    await deleteEmoji(workspaceId, emojiId);
    return c.body(null, 204);
  })
  .openapi(getEmojiImageRoute, async (c) => {
    const { workspaceId, emojiId } = c.req.valid("param");
    const row = await findEmoji(workspaceId, emojiId);
    if (!row) throw new HTTPException(404, { message: "Emoji not found" });
    try {
      const object = await getPrivateObject(row.objectKey);
      return new Response(object.body as BodyInit, {
        headers: {
          // The URL carries ?v=<version>, so the bytes never change under it.
          "Cache-Control": "private, max-age=31536000, immutable",
          "Content-Type": row.mimeType,
          "X-Content-Type-Options": "nosniff",
          Vary: "Cookie, Authorization",
        },
      });
    } catch (error) {
      console.error("Failed to stream emoji:", error);
      throw new HTTPException(404, { message: "Emoji not found" });
    }
  });

export default emoji;
