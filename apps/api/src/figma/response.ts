import { responseTimestamp, z } from "../openapi";

export const figmaPreviewSchema = z
  .object({
    url: z.string(),
    fileKey: z.string(),
    nodeId: z.string().nullable(),
    fileName: z.string(),
    frameName: z.string().nullable(),
    thumbnailUrl: z.string().nullable().openapi({
      description:
        "A signed image URL from Figma. It expires after a while; refresh the card for a new one.",
    }),
    fetchedAt: responseTimestamp.openapi({
      description: "When Kaneo last read this file from Figma.",
    }),
  })
  .openapi("FigmaPreview");
