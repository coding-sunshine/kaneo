import { and, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  documentTable,
  documentVersionTable,
  userTable,
} from "../../database/schema";
import { fingerprint } from "../fingerprint";
import { assertNotSuperseded } from "./assert-not-superseded";
import { getDocument } from "./get-document";
import { proposeLineage } from "./lineage";
import { loadDocument } from "./load-document";
import { recordVersion } from "./record-version";

export async function listVersions(
  workspaceId: string,
  id: string,
  userId: string,
) {
  await loadDocument(workspaceId, id, userId);
  return db
    .select({
      id: documentVersionTable.id,
      title: documentVersionTable.title,
      content: documentVersionTable.content,
      authorId: documentVersionTable.authorId,
      authorName: userTable.name,
      createdAt: documentVersionTable.createdAt,
      updatedAt: documentVersionTable.updatedAt,
    })
    .from(documentVersionTable)
    .leftJoin(userTable, eq(userTable.id, documentVersionTable.authorId))
    .where(eq(documentVersionTable.documentId, id))
    .orderBy(desc(documentVersionTable.createdAt));
}

export async function restoreVersion(
  workspaceId: string,
  id: string,
  userId: string,
  versionId: string,
) {
  const doc = await loadDocument(workspaceId, id, userId, { need: "edit" });
  assertNotSuperseded(doc);
  const [version] = await db
    .select({
      title: documentVersionTable.title,
      content: documentVersionTable.content,
    })
    .from(documentVersionTable)
    .where(
      and(
        eq(documentVersionTable.id, versionId),
        eq(documentVersionTable.documentId, id),
      ),
    );
  if (!version) {
    throw new HTTPException(404, { message: "Version not found" });
  }
  const prints = fingerprint(version.content);
  await db
    .update(documentTable)
    .set({
      ...version,
      fingerprint: prints,
      updatedAt: new Date(),
      updatedById: userId,
    })
    .where(eq(documentTable.id, id));
  // A restore is its own history entry, never folded into the last edit.
  await recordVersion(id, userId, version, { fold: false });
  await proposeLineage(doc, prints, userId);
  return getDocument(workspaceId, id, userId);
}
