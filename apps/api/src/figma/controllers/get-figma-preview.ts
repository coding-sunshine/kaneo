import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { figmaLinkPreviewTable } from "../../database/schema";
import { fetchFigmaFile } from "../figma-api";
import { logFigmaOffOnce, readFigmaToken } from "../figma-config";
import { parseFigmaUrl } from "../parse-figma-url";

type StoredPreview = typeof figmaLinkPreviewTable.$inferSelect;

function present(row: StoredPreview) {
  return {
    url: row.url,
    fileKey: row.fileKey,
    nodeId: row.nodeId || null,
    fileName: row.fileName,
    frameName: row.frameName,
    thumbnailUrl: row.thumbnailUrl,
    fetchedAt: row.fetchedAt,
  };
}

/**
 * Serves a workspace's stored card for a Figma link, reading Figma only when
 * there is none yet or the caller asks for a refresh.
 */
export async function getFigmaPreview({
  workspaceId,
  url,
  refresh = false,
}: {
  workspaceId: string;
  url: string;
  refresh?: boolean;
}) {
  const token = readFigmaToken();
  if (!token) {
    logFigmaOffOnce();
    throw new HTTPException(404, { message: "Figma previews are off" });
  }
  const link = parseFigmaUrl(url);
  if (!link) {
    throw new HTTPException(400, { message: "Not a Figma file link" });
  }
  const nodeId = link.nodeId ?? "";

  if (!refresh) {
    const [stored] = await db
      .select()
      .from(figmaLinkPreviewTable)
      .where(
        and(
          eq(figmaLinkPreviewTable.workspaceId, workspaceId),
          eq(figmaLinkPreviewTable.fileKey, link.fileKey),
          eq(figmaLinkPreviewTable.nodeId, nodeId),
        ),
      )
      .limit(1);
    if (stored) return present(stored);
  }

  const result = await fetchFigmaFile(
    { fileKey: link.fileKey, nodeId: link.nodeId },
    { token },
  );
  if (result.status === "not_found") {
    throw new HTTPException(404, {
      message: "Figma file not found, or not shared with this instance",
    });
  }
  if (result.status === "failed") {
    throw new HTTPException(502, { message: "Figma did not answer" });
  }

  const values = {
    url: link.url,
    fileName: result.file.fileName,
    frameName: result.file.frameName,
    thumbnailUrl: result.file.thumbnailUrl,
    fetchedAt: new Date(),
  };
  const [row] = await db
    .insert(figmaLinkPreviewTable)
    .values({ workspaceId, fileKey: link.fileKey, nodeId, ...values })
    .onConflictDoUpdate({
      target: [
        figmaLinkPreviewTable.workspaceId,
        figmaLinkPreviewTable.fileKey,
        figmaLinkPreviewTable.nodeId,
      ],
      set: values,
    })
    .returning();
  if (!row) throw new Error("Figma preview was not stored");
  return present(row);
}
