import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { figmaLinkPreviewTable } from "../../database/schema";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { fetchFigmaFile } from "../figma-api";
import { logFigmaOffOnce, readFigmaToken } from "../figma-config";
import {
  FIGMA_THUMBNAIL_TTL_MS,
  figmaLookupLimited,
  recentFigmaFailure,
  rememberFigmaFailure,
  takeFigmaLookup,
} from "../figma-limits";
import { figmaLinkReferenced } from "../figma-link-referenced";
import { type FigmaLink, parseFigmaUrl } from "../parse-figma-url";

type StoredPreview = typeof figmaLinkPreviewTable.$inferSelect;

// One answer for "off", "not linked here", "not yours" and "token cannot open
// it", so the status says nothing about files the token can see.
const notFound = () =>
  new HTTPException(404, { message: "Figma preview not found" });

function present(row: StoredPreview, { withThumbnail = true } = {}) {
  return {
    url: row.url,
    fileKey: row.fileKey,
    nodeId: row.nodeId || null,
    fileName: row.fileName,
    frameName: row.frameName,
    thumbnailUrl: withThumbnail ? row.thumbnailUrl : null,
    fetchedAt: row.fetchedAt,
  };
}

type Lookup =
  | { status: "ok"; row: StoredPreview }
  | { status: 404 | 502 }
  | { status: 429; retryAfterSeconds: number };

/** Reads Figma, within the person's cap and the remembered failures. */
async function lookUp({
  workspaceId,
  userId,
  link,
  token,
}: {
  workspaceId: string;
  userId: string;
  link: FigmaLink;
  token: string;
}): Promise<Lookup> {
  const nodeId = link.nodeId ?? "";
  const failed = recentFigmaFailure(workspaceId, link.fileKey, nodeId);
  if (failed) return { status: failed };
  const turn = takeFigmaLookup(userId);
  if (!turn.ok)
    return { status: 429, retryAfterSeconds: turn.retryAfterSeconds };

  const result = await fetchFigmaFile(
    { fileKey: link.fileKey, nodeId: link.nodeId },
    { token },
  );
  if (result.status !== "ok") {
    const status = result.status === "not_found" ? 404 : 502;
    rememberFigmaFailure(workspaceId, link.fileKey, nodeId, status);
    return { status };
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
  return { status: "ok", row };
}

function fail(lookup: Exclude<Lookup, { status: "ok" }>): never {
  if (lookup.status === 429) throw figmaLookupLimited(lookup.retryAfterSeconds);
  if (lookup.status === 502)
    throw new HTTPException(502, { message: "Figma did not answer" });
  throw notFound();
}

/**
 * Serves a workspace's card for a Figma link the person can see linked in the
 * workspace. Figma is read only when there is no card yet, its image link has
 * expired, or the person asks for a refresh.
 */
export async function getFigmaPreview({
  workspaceId,
  userId,
  url,
  refresh = false,
}: {
  workspaceId: string;
  userId: string;
  url: string;
  refresh?: boolean;
}) {
  const token = readFigmaToken();
  if (!token) {
    logFigmaOffOnce();
    throw notFound();
  }
  const link = parseFigmaUrl(url);
  if (!link) {
    throw new HTTPException(400, { message: "Not a Figma file link" });
  }
  if (
    (await isWorkspaceGuest(workspaceId, userId)) ||
    !(await figmaLinkReferenced({
      workspaceId,
      userId,
      fileKey: link.fileKey,
    }))
  )
    throw notFound();

  const lookup = () => lookUp({ workspaceId, userId, link, token });
  if (refresh) {
    const result = await lookup();
    return result.status === "ok" ? present(result.row) : fail(result);
  }

  const [stored] = await db
    .select()
    .from(figmaLinkPreviewTable)
    .where(
      and(
        eq(figmaLinkPreviewTable.workspaceId, workspaceId),
        eq(figmaLinkPreviewTable.fileKey, link.fileKey),
        eq(figmaLinkPreviewTable.nodeId, link.nodeId ?? ""),
      ),
    )
    .limit(1);
  if (!stored) {
    const result = await lookup();
    return result.status === "ok" ? present(result.row) : fail(result);
  }
  if (Date.now() - stored.fetchedAt.getTime() < FIGMA_THUMBNAIL_TTL_MS)
    return present(stored);

  // The stored image link has expired: get a new one, or show no image
  // rather than a broken one.
  const result = await lookup();
  return result.status === "ok"
    ? present(result.row)
    : present(stored, { withThumbnail: false });
}
