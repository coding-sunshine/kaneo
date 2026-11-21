import { z } from "../openapi";
import {
  EMOJI_MAX_BYTES,
  EMOJI_MIME_TYPES,
  EMOJI_NAME_MAX_LENGTH,
  EMOJI_NAME_PATTERN,
} from "./constants";

export const workspaceIdParam = z.object({ workspaceId: z.string().min(1) });

export const emojiParam = z.object({
  workspaceId: z.string().min(1),
  emojiId: z.string().min(1),
});

const name = z
  .string()
  .min(1)
  .max(EMOJI_NAME_MAX_LENGTH)
  .regex(EMOJI_NAME_PATTERN)
  .openapi({
    description:
      "Lowercase letters, digits, underscores and hyphens. Reactions store it as :name:.",
  });

const contentType = z.enum(EMOJI_MIME_TYPES);
const size = z
  .number()
  .int()
  .positive()
  .max(EMOJI_MAX_BYTES)
  .openapi({ description: "Image size in bytes, at most 500,000." });

export const prepareEmojiUploadBody = z.object({
  name,
  contentType,
  size,
});

export const createEmojiBody = z.object({
  name,
  key: z.string(),
  version: z.string(),
  contentType,
  size,
});
