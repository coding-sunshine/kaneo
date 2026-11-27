import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

const s3 = vi.hoisted(() => ({
  readObject: vi.fn(),
  copyToDocumentFile: vi.fn(),
}));
vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPrivateObject: s3.readObject,
  copyToDocumentFile: s3.copyToDocumentFile,
}));

const ASSET_LINK = /\/api\/asset\/([a-z0-9]+)/;

// A revision, or a copy an assistant saves, carries the old document's file
// links. Its readers may not be able to open the old document, so the new
// document gets its own copy of each file its author could open.
describe("API integration: files linked from another document", () => {
  let world: DocumentWorld;

  beforeEach(async () => {
    await resetTestDatabase();
    world = await buildDocumentWorld();
    s3.readObject.mockReset();
    s3.readObject.mockResolvedValue({
      body: new Uint8Array([1, 2, 3]),
      contentType: "application/pdf",
      contentLength: 3,
    });
    s3.copyToDocumentFile.mockReset();
    s3.copyToDocumentFile.mockImplementation(async () => randomUUID());
  });

  const fileOf = async (documentId: string) => {
    const [row] = await db
      .insert(schema.assetTable)
      .values({
        workspaceId: world.ws,
        documentId,
        objectKey: randomUUID(),
        filename: "plan.pdf",
        mimeType: "application/pdf",
        size: 3,
        kind: "attachment",
        surface: "document",
        createdBy: world.owner.id,
      })
      .returning();
    if (!row) throw new Error("The file was not stored");
    return row.id;
  };

  const textWith = (fileId: string) =>
    `<p>The plan</p><kaneo-attachment url="http://localhost:1337/api/asset/${fileId}" filename="plan.pdf" mime-type="application/pdf" size="3" />`;

  const linkIn = async (documentId: string) => {
    const [doc] = await db
      .select({ content: schema.documentTable.content })
      .from(schema.documentTable)
      .where(eq(schema.documentTable.id, documentId));
    const id = doc?.content.match(ASSET_LINK)?.[1];
    if (!id) throw new Error("The document links no file");
    return id;
  };

  const filesOf = (documentId: string) =>
    db
      .select()
      .from(schema.assetTable)
      .where(eq(schema.assetTable.documentId, documentId));

  it("lets a reader of a revision load its file without the original", async () => {
    const fileId = await fileOf(world.docs.teamBeta);
    const created = await world.as(world.owner)(
      "/document",
      json("POST", {
        workspaceId: world.ws,
        title: "Plan, second edition",
        content: textWith(fileId),
        projectId: world.alpha.id,
      }),
    );
    expect(created.status).toBe(200);
    const { id: revisionId } = (await created.json()) as { id: string };

    const copyId = await linkIn(revisionId);
    expect(copyId).not.toBe(fileId);
    const [copy] = await filesOf(revisionId);
    expect(copy?.id).toBe(copyId);
    expect(copy?.filename).toBe("plan.pdf");

    const reader = world.as(world.limited);
    expect((await reader(`/asset/${copyId}`)).status).toBe(200);
    // The original stays closed to them.
    expect((await reader(`/asset/${fileId}`)).status).toBe(404);
  });

  it("gives a copy saved from a chat its own file", async () => {
    const fileId = await fileOf(world.docs.teamBeta);
    const saved = await world.as(world.owner)(
      "/document/file",
      json("POST", {
        workspaceId: world.ws,
        title: "Plan from chat",
        markdown: textWith(fileId),
        idempotencyKey: randomUUID(),
      }),
    );
    expect(saved.status).toBe(200);
    const { id } = (await saved.json()) as { id: string };
    await world.as(world.owner)(
      `/document/workspace/${world.ws}/${id}/share/${world.limited.id}`,
      json("PUT", { access: "view" }),
    );

    const copyId = await linkIn(id);
    expect(copyId).not.toBe(fileId);
    expect((await world.as(world.limited)(`/asset/${copyId}`)).status).toBe(
      200,
    );
  });

  it("copies a file pasted in by an edit once, however often it is saved", async () => {
    const fileId = await fileOf(world.docs.teamBeta);
    const save = () =>
      world.as(world.owner)(
        `/document/workspace/${world.ws}/${world.docs.teamAlpha}`,
        json("PATCH", { content: textWith(fileId) }),
      );
    expect((await save()).status).toBe(200);
    const copyId = await linkIn(world.docs.teamAlpha);
    // The editor still holds the old text and sends it again.
    expect((await save()).status).toBe(200);

    expect(await linkIn(world.docs.teamAlpha)).toBe(copyId);
    expect(await filesOf(world.docs.teamAlpha)).toHaveLength(1);
    expect(s3.copyToDocumentFile).toHaveBeenCalledTimes(1);
    expect((await world.as(world.limited)(`/asset/${copyId}`)).status).toBe(
      200,
    );
  });

  it("copies nothing from a document the author cannot open", async () => {
    // Only the owner can open their private draft.
    const fileId = await fileOf(world.docs.private);
    const created = await world.as(world.open)(
      "/document",
      json("POST", {
        workspaceId: world.ws,
        title: "Borrowed link",
        content: textWith(fileId),
        projectId: world.alpha.id,
      }),
    );
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };

    expect(await linkIn(id)).toBe(fileId);
    expect(await filesOf(id)).toHaveLength(0);
    expect(s3.copyToDocumentFile).not.toHaveBeenCalled();
    expect((await world.as(world.limited)(`/asset/${fileId}`)).status).toBe(
      404,
    );
  });

  it("keeps the save and the old link when the file cannot be copied", async () => {
    s3.copyToDocumentFile.mockRejectedValue(new Error("storage is down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fileId = await fileOf(world.docs.teamBeta);
    const created = await world.as(world.owner)(
      "/document",
      json("POST", {
        workspaceId: world.ws,
        title: "Plan while storage is down",
        content: textWith(fileId),
        projectId: world.alpha.id,
      }),
    );
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };

    expect(await linkIn(id)).toBe(fileId);
    expect(await filesOf(id)).toHaveLength(0);
  });
});
