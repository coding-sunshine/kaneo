import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { S3Client } from "../../apps/api/node_modules/@aws-sdk/client-s3";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { mockAnonymousSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

// The name of the constraint that refused a write, or null when it went in.
const refusedBy = async (write: PromiseLike<unknown>) => {
  try {
    await write;
    return null;
  } catch (error) {
    const { cause, constraint } = error as {
      cause?: { constraint?: string };
      constraint?: string;
    };
    return cause?.constraint ?? constraint ?? String(error);
  }
};

const queuedKeys = async () =>
  (await db.select().from(schema.storageCleanupTable))
    .map((row) => row.objectKey)
    .sort();

describe("API integration: a document owns a file", () => {
  let world: DocumentWorld;
  let key: number;
  const file = (
    owner: Partial<typeof schema.assetTable.$inferInsert>,
  ): typeof schema.assetTable.$inferInsert => ({
    workspaceId: world.ws,
    objectKey: `workspace/${world.ws}/file-${++key}.pdf`,
    filename: "notes.pdf",
    mimeType: "application/pdf",
    size: 3,
    kind: "attachment",
    surface: "document",
    createdBy: world.owner.id,
    ...owner,
  });
  const add = async (owner: Parameters<typeof file>[0]) => {
    const [row] = await db
      .insert(schema.assetTable)
      .values(file(owner))
      .returning();
    if (!row) throw new Error("The file was not stored");
    return row;
  };

  beforeEach(async () => {
    await resetTestDatabase();
    world = await buildDocumentWorld();
    key = 0;
  });

  it("stores a document's file with no team on the row", async () => {
    const row = await add({ documentId: world.docs.private });

    expect(row).toMatchObject({
      documentId: world.docs.private,
      projectId: null,
      taskId: null,
    });
  });

  it("refuses a file with no owner, with two, or with a document and an issue", async () => {
    const insert = (owner: Parameters<typeof file>[0]) =>
      refusedBy(db.insert(schema.assetTable).values(file(owner)));

    expect(await insert({})).toBe("asset_one_owner");
    expect(
      await insert({
        documentId: world.docs.teamAlpha,
        projectId: world.alpha.id,
      }),
    ).toBe("asset_one_owner");
    expect(
      await insert({
        documentId: world.docs.issueAlpha,
        taskId: world.alphaTask.id,
      }),
    ).toBe("asset_document_file_unattached");
    // An issue's file goes in as before.
    expect(
      await insert({
        projectId: world.alpha.id,
        taskId: world.alphaTask.id,
      }),
    ).toBeNull();
  });

  it("queues the stored object when the document's row goes", async () => {
    const row = await add({ documentId: world.docs.private });

    await db
      .delete(schema.documentTable)
      .where(eq(schema.documentTable.id, world.docs.private));

    expect(
      await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.id, row.id)),
    ).toEqual([]);
    expect(await queuedKeys()).toEqual([row.objectKey]);
  });

  it("deletes the row when its object is already queued", async () => {
    // Deleting a workspace queues every key first, then the rows cascade.
    const row = await add({ documentId: world.docs.private });
    await db
      .insert(schema.storageCleanupTable)
      .values({ objectKey: row.objectKey });

    await db
      .delete(schema.documentTable)
      .where(eq(schema.documentTable.id, world.docs.private));

    expect(await queuedKeys()).toEqual([row.objectKey]);
  });

  it("queues a document's file when its team goes", async () => {
    const row = await add({ documentId: world.docs.teamAlpha });

    await db
      .delete(schema.projectTable)
      .where(eq(schema.projectTable.id, world.alpha.id));

    expect(await db.select().from(schema.assetTable)).toEqual([]);
    expect(await queuedKeys()).toEqual([row.objectKey]);
  });

  it("drops the record of a file with its document", async () => {
    const row = await add({ documentId: world.docs.private });
    await db.insert(schema.documentFileTable).values({
      documentId: world.docs.private,
      assetId: row.id,
      originalName: "Notes (final).pdf",
      sourceClient: "web",
      sourceUserId: world.owner.id,
    });

    await db
      .delete(schema.documentTable)
      .where(eq(schema.documentTable.id, world.docs.private));

    expect(await db.select().from(schema.documentFileTable)).toEqual([]);
  });
});

describe("API integration: uploading a file into a document", () => {
  let world: DocumentWorld;
  type Request = ReturnType<DocumentWorld["as"]>;
  type Payload = {
    key: string;
    uploadUrl: string;
    headers: Record<string, string>;
  };

  const base = (id: string) => `/document/workspace/${world.ws}/${id}`;
  const prefix = (id: string) => `workspace/${world.ws}/document/${id}/`;
  const upload = (request: Request, id: string, body: unknown) =>
    request(`${base(id)}/upload`, json("PUT", body));
  const finalize = (request: Request, id: string, body: unknown) =>
    request(`${base(id)}/upload/finalize`, json("POST", body));
  const send = () => vi.mocked(S3Client.prototype.send);
  const head = (ContentLength: number, ContentType: string) =>
    send().mockResolvedValueOnce({ ContentLength, ContentType });
  const rows = async () => ({
    assets: await db.select().from(schema.assetTable),
    files: await db.select().from(schema.documentFileTable),
  });
  const expectNoRows = async () => {
    expect(await rows()).toEqual({ assets: [], files: [] });
  };
  const doc = () => world.docs.teamAlpha;
  const finalizeBody = (id: string, over: Record<string, unknown> = {}) => ({
    key: `${prefix(id)}plan-1-abc.pdf`,
    filename: "Plan.pdf",
    size: 1234,
    ...over,
  });
  // A document file that went in through the success path.
  const stored = async (id: string) => {
    head(1234, "application/pdf");
    const response = await finalize(
      world.as(world.owner),
      id,
      finalizeBody(id),
    );
    expect(response.status).toBe(200);
    return {
      key: finalizeBody(id).key,
      ...((await response.json()) as { id: string }),
    };
  };

  beforeEach(async () => {
    await resetTestDatabase();
    world = await buildDocumentWorld();
    process.env.S3_ENDPOINT = "https://storage.example.test";
    process.env.S3_BUCKET = "test-bucket";
    process.env.S3_ACCESS_KEY_ID = "test-access-key";
    process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
    delete process.env.S3_KEY_PREFIX;
    vi.spyOn(S3Client.prototype, "send").mockRejectedValue(
      new Error("No uploaded-object fixture configured"),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("the content type", () => {
    const allowed: Array<[string, string]> = [
      ["a.pdf", "application/pdf"],
      ["a.doc", "application/msword"],
      [
        "a.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      ["a.xls", "application/vnd.ms-excel"],
      [
        "a.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
      ["a.ppt", "application/vnd.ms-powerpoint"],
      [
        "a.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ],
      ["a.odt", "application/vnd.oasis.opendocument.text"],
      ["a.ods", "application/vnd.oasis.opendocument.spreadsheet"],
      ["a.odp", "application/vnd.oasis.opendocument.presentation"],
      ["a.txt", "text/plain"],
      ["a.md", "text/markdown"],
      ["a.csv", "text/csv"],
      ["a.png", "image/png"],
      ["a.jpg", "image/jpeg"],
      ["a.jpeg", "image/jpeg"],
      ["a.gif", "image/gif"],
      ["a.webp", "image/webp"],
      ["a.avif", "image/avif"],
      ["a.heic", "image/heic"],
      ["a.heif", "image/heif"],
      ["A.PNG", "image/png"],
    ];

    it.each(allowed)(
      "takes the type of %s from its extension",
      async (filename, type) => {
        const response = await upload(world.as(world.owner), doc(), {
          filename,
          size: 10,
        });

        expect(response.status).toBe(200);
        expect(
          ((await response.json()) as Payload).headers["Content-Type"],
        ).toBe(type);
      },
    );

    const refused = [
      "run.exe",
      "page.html",
      "drawing.svg",
      "archive.zip",
      "README",
      "x.constructor",
      "report.pdf.exe",
    ];

    it.each(refused)("refuses %s on both routes", async (filename) => {
      const request = world.as(world.owner);
      const start = await upload(request, doc(), { filename, size: 10 });
      const end = await finalize(
        request,
        doc(),
        finalizeBody(doc(), { filename, key: `${prefix(doc())}a-1-b.pdf` }),
      );

      expect([start.status, end.status]).toEqual([415, 415]);
      expect(send()).not.toHaveBeenCalled();
      await expectNoRows();
    });
  });

  it("builds a key from the name and the document", async () => {
    const response = await upload(world.as(world.owner), doc(), {
      filename: "Plan v2.PDF",
      size: 10,
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Payload;
    expect(payload.key).toMatch(
      new RegExp(
        `^workspace/${world.ws.toLowerCase()}/document/${doc().toLowerCase()}/plan-v2-\\d+-[a-z0-9]+\\.pdf$`,
      ),
    );
    expect(payload.headers["Content-Type"]).toBe("application/pdf");
    expect(payload.uploadUrl).toContain(payload.key.split("/").pop());
    await expectNoRows();
  });

  it("refuses an empty file and a huge one", async () => {
    for (const size of [0, Number.MAX_SAFE_INTEGER]) {
      const response = await upload(world.as(world.owner), doc(), {
        filename: "a.pdf",
        size,
      });
      expect(response.status).toBe(400);
    }
  });

  describe("finalizing", () => {
    it("stores the file and the record of it", async () => {
      head(1234, "application/pdf");
      const response = await finalize(
        world.as(world.owner),
        doc(),
        finalizeBody(doc()),
      );

      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        id: string;
        url: string;
        kind: string;
        mimeType: string;
      };
      expect(payload).toMatchObject({
        kind: "attachment",
        mimeType: "application/pdf",
      });
      expect(payload.url.endsWith(`/asset/${payload.id}`)).toBe(true);
      const { assets, files } = await rows();
      expect(assets).toHaveLength(1);
      expect(assets[0]).toMatchObject({
        id: payload.id,
        workspaceId: world.ws,
        documentId: doc(),
        projectId: null,
        taskId: null,
        objectKey: finalizeBody(doc()).key,
        filename: "Plan.pdf",
        mimeType: "application/pdf",
        size: 1234,
        kind: "attachment",
        surface: "document",
        createdBy: world.owner.id,
      });
      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({
        assetId: payload.id,
        documentId: doc(),
        originalName: "Plan.pdf",
        sourceClient: "web",
        sourceUserId: world.owner.id,
      });
    });

    it("stores a picture as an image", async () => {
      head(1234, "image/png");
      const response = await finalize(
        world.as(world.owner),
        doc(),
        finalizeBody(doc(), {
          filename: "photo.png",
          key: `${prefix(doc())}photo-1-abc.png`,
        }),
      );

      expect(response.status).toBe(200);
      expect(((await response.json()) as { kind: string }).kind).toBe("image");
      expect((await rows()).assets[0]?.kind).toBe("image");
    });

    it("answers the same when the same key is finalized twice", async () => {
      const request = world.as(world.owner);
      head(1234, "application/pdf");
      const first = await finalize(request, doc(), finalizeBody(doc()));
      head(1234, "application/pdf");
      const second = await finalize(request, doc(), finalizeBody(doc()));

      expect([first.status, second.status]).toEqual([200, 200]);
      expect(((await second.json()) as { id: string }).id).toBe(
        ((await first.json()) as { id: string }).id,
      );
      const { assets, files } = await rows();
      expect([assets.length, files.length]).toEqual([1, 1]);
    });

    const own = () => prefix(doc());
    const badKeys: Array<[string, () => string]> = [
      [
        "another document",
        () => `workspace/${world.ws}/document/${world.docs.private}/a.pdf`,
      ],
      [
        "an issue",
        () =>
          `workspace/${world.ws}/project/${world.alpha.id}/task/${world.alphaTask.id}/attachments/a.pdf`,
      ],
      ["a traversal", () => `${own()}../x.pdf`],
      ["a dotfile", () => `${own()}.hidden.pdf`],
      ["a nested path", () => `${own()}a/b.pdf`],
    ];

    it.each(badKeys)("refuses a key from %s", async (_name, key) => {
      const response = await finalize(
        world.as(world.owner),
        doc(),
        finalizeBody(doc(), { key: key() }),
      );

      expect(response.status).toBe(400);
      expect(send()).not.toHaveBeenCalled();
      await expectNoRows();
    });

    it("refuses an object of another type", async () => {
      head(1234, "text/html");
      const response = await finalize(
        world.as(world.owner),
        doc(),
        finalizeBody(doc()),
      );

      expect(response.status).toBe(400);
      await expectNoRows();
    });

    it("refuses an object of another size", async () => {
      head(999, "application/pdf");
      const response = await finalize(
        world.as(world.owner),
        doc(),
        finalizeBody(doc()),
      );

      expect(response.status).toBe(400);
      await expectNoRows();
    });

    it("does not take a document's file through the issue route", async () => {
      const file = await stored(doc());
      send().mockClear();

      const response = await world.as(world.owner)(
        `/task/image-upload/${world.alphaTask.id}/finalize`,
        json("POST", {
          key: file.key,
          filename: "a.pdf",
          contentType: "application/pdf",
          size: 1234,
          surface: "attachment",
        }),
      );

      expect(response.status).toBe(400);
      expect(send()).not.toHaveBeenCalled();
      const { assets } = await rows();
      expect(assets).toHaveLength(1);
      expect(assets[0]).toMatchObject({ documentId: doc(), taskId: null });
    });
  });

  describe("who may upload", () => {
    type Route = [string, (request: Request, id: string) => Promise<Response>];
    const routes: Route[] = [
      [
        "upload",
        (request, id) => upload(request, id, { filename: "a.pdf", size: 10 }),
      ],
      [
        "finalize",
        (request, id) =>
          finalize(
            request,
            id,
            finalizeBody(id, { key: `${prefix(id)}a-1-b.pdf` }),
          ),
      ],
    ];

    describe.each(routes)("on %s", (_name, call) => {
      it.each([
        ["limited", "teamBeta"],
        ["open", "private"],
      ] as const)("hides a document %s cannot open", async (who, place) => {
        const hidden = await call(world.as(world[who]), world.docs[place]);
        const invented = await call(world.as(world[who]), "no-such-document");

        expect(hidden.status).toBe(404);
        expect(hidden.status).toBe(invented.status);
        expect(await hidden.json()).toEqual(await invented.json());
        expect(send()).not.toHaveBeenCalled();
      });

      it("needs a login", async () => {
        const request = world.as(world.owner);
        mockAnonymousSession();

        const response = await call(request, doc());

        expect(response.status).toBe(401);
        expect(send()).not.toHaveBeenCalled();
      });

      it("refuses a viewer", async () => {
        const response = await call(
          world.as(world.limited),
          world.docs.sharedInBeta,
        );

        expect(response.status).toBe(403);
        expect(send()).not.toHaveBeenCalled();
      });

      it("hides a document in the trash", async () => {
        const trashed = await world.as(world.owner)(
          base(doc()),
          json("DELETE"),
        );
        expect(trashed.status).toBe(200);

        const response = await call(world.as(world.owner), doc());

        expect(response.status).toBe(404);
        expect(send()).not.toHaveBeenCalled();
      });

      it("refuses a superseded document", async () => {
        await db
          .update(schema.documentTable)
          .set({ status: "superseded" })
          .where(eq(schema.documentTable.id, doc()));

        const response = await call(world.as(world.owner), doc());

        expect(response.status).toBe(409);
        expect(send()).not.toHaveBeenCalled();
      });

      it("refuses an API key that can only read", async () => {
        const response = await withKey({ task: ["read"] }, call);

        expect(response.status).toBe(403);
        expect(send()).not.toHaveBeenCalled();
      });
    });

    const withKey = async (
      permissions: Record<string, string[]>,
      call: Route[1],
    ) => {
      const { key } = await auth.api.createApiKey({
        body: { userId: world.owner.id, name: "Doc upload", permissions },
      });
      // The same call, with the key as the only credential.
      const request = ((path: string, init?: RequestInit) => {
        const asOwner = world.as(world.owner);
        mockAnonymousSession();
        return asOwner(path, {
          ...init,
          headers: { ...init?.headers, "x-api-key": key },
        } as never);
      }) as Request;
      return call(request, doc());
    };

    it("takes an API key that can update", async () => {
      const response = await withKey({ task: ["update"] }, routes[0]![1]);

      expect(response.status).toBe(200);
    });

    it("gives a member the same answer as editing the text", async () => {
      const edit = await world.as(world.open)(
        base(world.docs.teamAlpha),
        json("PATCH", { title: "x" }),
      );
      const start = await upload(world.as(world.open), world.docs.teamAlpha, {
        filename: "a.pdf",
        size: 10,
      });

      expect([200, 403]).toContain(edit.status);
      expect(start.status).toBe(edit.status);
    });
  });
});
