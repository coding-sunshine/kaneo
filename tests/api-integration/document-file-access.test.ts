import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { mockAnonymousSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

const { readObject } = vi.hoisted(() => ({
  readObject: vi.fn(),
}));
vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPrivateObject: readObject,
}));

type Request = ReturnType<DocumentWorld["as"]>;

describe("API integration: who can fetch a document's file", () => {
  let world: DocumentWorld;

  beforeEach(async () => {
    await resetTestDatabase();
    world = await buildDocumentWorld();
    readObject.mockReset();
    readObject.mockResolvedValue({
      body: new Uint8Array([1, 2, 3]),
      contentType: "application/pdf",
      contentLength: 3,
    });
  });

  const fileOf = async (documentId: string) => {
    const [row] = await db
      .insert(schema.assetTable)
      .values({
        workspaceId: world.ws,
        documentId,
        objectKey: randomUUID(),
        filename: "notes.pdf",
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

  const expectServed = async (request: Request, fileId: string) => {
    const response = await request(`/asset/${fileId}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/^private,/);
    expect(response.headers.get("content-type")).toBe(
      "application/octet-stream",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment/);
  };

  const expectMissing = async (request: Request, fileId: string) => {
    const unknown = await request("/asset/no-such-file");
    const hidden = await request(`/asset/${fileId}`);
    expect(unknown.status).toBe(404);
    expect(hidden.status).toBe(unknown.status);
    expect(await hidden.json()).toEqual(await unknown.json());
    expect(readObject).not.toHaveBeenCalled();
  };

  it("serves the file to people who can open the document", async () => {
    const { docs, owner, open, limited } = world;
    const cases = [
      [owner, docs.private],
      [open, docs.teamAlpha],
      [limited, docs.teamAlpha],
      [limited, docs.sharedInBeta],
      [open, docs.workspace],
    ] as const;

    for (const [user, documentId] of cases) {
      await expectServed(world.as(user), await fileOf(documentId));
    }
  });

  it("hides the file of a document the member cannot open", async () => {
    const { docs, open, limited } = world;
    const cases = [
      [open, docs.private],
      [limited, docs.teamBeta],
      [limited, docs.issueBeta],
      [limited, docs.projectBeta],
    ] as const;

    for (const [user, documentId] of cases) {
      await expectMissing(world.as(user), await fileOf(documentId));
    }
  });

  it("hides another person's private document from the workspace owner", async () => {
    const created = await world.as(world.open)(
      "/document",
      json("POST", {
        workspaceId: world.ws,
        title: "Mine only",
        content: "<p>mine</p>",
      }),
    );
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };
    const fileId = await fileOf(id);

    await expectMissing(world.as(world.owner), fileId);
    await expectServed(world.as(world.open), fileId);
  });

  it("serves nothing without a login, even in a public team", async () => {
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, world.alpha.id));
    const fileId = await fileOf(world.docs.teamAlpha);

    const request = world.as(world.owner);
    mockAnonymousSession();
    await expectMissing(request, fileId);
  });

  it("follows a share with an issue", async () => {
    const fileId = await fileOf(world.docs.private);
    const shareUrl = `/document/workspace/${world.ws}/${world.docs.private}/task/${world.alphaTask.id}/share`;
    await expectMissing(world.as(world.limited), fileId);

    const shared = await world.as(world.owner)(shareUrl, json("PUT"));
    expect(shared.status).toBe(200);
    await expectServed(world.as(world.limited), fileId);

    const removed = await world.as(world.owner)(shareUrl, json("DELETE"));
    expect(removed.status).toBe(200);
    readObject.mockClear();
    await expectMissing(world.as(world.limited), fileId);
  });

  it("hides the file while the document is in the trash", async () => {
    const fileId = await fileOf(world.docs.teamAlpha);
    const path = `/document/workspace/${world.ws}/${world.docs.teamAlpha}`;

    const trashed = await world.as(world.owner)(path, json("DELETE"));
    expect(trashed.status).toBe(200);
    await expectMissing(world.as(world.open), fileId);
    await expectMissing(world.as(world.owner), fileId);

    const restored = await world.as(world.owner)(
      `${path}/restore`,
      json("POST"),
    );
    expect(restored.status).toBe(200);
    await expectServed(world.as(world.open), fileId);
  });

  it("needs read permission on an API key", async () => {
    const fileId = await fileOf(world.docs.private);
    const keyWith = async (permissions: Record<string, string[]>) => {
      const { key } = await auth.api.createApiKey({
        body: { userId: world.owner.id, name: "File access", permissions },
      });
      return key;
    };
    const send = (key: string, id: string) => {
      const request = world.as(world.owner);
      mockAnonymousSession();
      return request(`/asset/${id}`, {
        headers: { "x-api-key": key },
      } as never);
    };

    const narrow = await keyWith({ project: ["read"] });
    const unknown = await send(narrow, "no-such-file");
    const hidden = await send(narrow, fileId);
    expect(hidden.status).toBe(unknown.status);
    expect(await hidden.json()).toEqual(await unknown.json());
    expect(readObject).not.toHaveBeenCalled();

    const wide = await keyWith({ task: ["read"] });
    expect((await send(wide, fileId)).status).toBe(200);
  });

  it("hides the file while the workspace is archived", async () => {
    const fileId = await fileOf(world.docs.teamAlpha);
    const setArchived = (archived: boolean) =>
      db
        .update(schema.workspaceTable)
        .set({ archivedAt: archived ? new Date() : null })
        .where(eq(schema.workspaceTable.id, world.ws));

    await setArchived(true);
    await expectMissing(world.as(world.owner), fileId);

    await setArchived(false);
    await expectServed(world.as(world.owner), fileId);
  });
});
