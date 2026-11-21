import { responseTimestamp, z } from "../openapi";

export const emojiSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    url: z.string().openapi({
      description: "Where to download the image; requires workspace access.",
    }),
    createdBy: z.string().nullable(),
    createdAt: responseTimestamp,
  })
  .openapi("WorkspaceEmoji");

export const emojiListSchema = z.array(emojiSchema);

export const emojiUploadSchema = z
  .object({
    key: z.string(),
    uploadUrl: z.string(),
    version: z.string(),
    headers: z.record(z.string(), z.string()),
  })
  .openapi("WorkspaceEmojiUpload");
