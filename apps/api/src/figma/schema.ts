import { z } from "../openapi";

const url = z.string().min(1).max(2048).openapi({
  description:
    "A figma.com file, design, prototype or board link, optionally with a `node-id` for one frame.",
});

export const figmaPreviewQuery = z.object({
  workspaceId: z.string().min(1),
  url,
});

export const figmaPreviewBody = z.object({
  workspaceId: z.string().min(1),
  url,
});
