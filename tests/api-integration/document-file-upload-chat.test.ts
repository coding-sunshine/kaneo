import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import {
  PutObjectCommand,
  S3Client,
} from "../../apps/api/node_modules/@aws-sdk/client-s3";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { mockAnonymousSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

// What an assistant sends when a person asks it, in a chat, to put a file
// into a document. The bytes come in the request; the API stores them.
describe("API integration: a file from an assistant chat goes into a document", () => {
  let world: DocumentWorld;
  type Request = ReturnType<DocumentWorld["as"]>;
  type Stored = { id: string; url: string; kind: string; mimeType: string };

  const PDF = Buffer.from("%PDF-1.4 plan");
  const base = (id: string) => `/document/workspace/${world.ws}/${id}`;
  const prefix = (id: string) => `workspace/${world.ws}/document/${id}/`;
  const attach = (request: Request, id: string, body: unknown) =>
    request(`${base(id)}/files`, json("POST", body));
  const fileBody = (over: Record<string, unknown> = {}) => ({
    filename: "Plan.pdf",
    contentBase64: PDF.toString("base64"),
    sourceClient: "claude",
    ...over,
  });
  const send = () => vi.mocked(S3Client.prototype.send);
  const rows = async () => ({
    assets: await db.select().from(schema.assetTable),
    files: await db.select().from(schema.documentFileTable),
  });
  const expectNoRows = async () => {
    expect(await rows()).toEqual({ assets: [], files: [] });
  };
  const doc = () => world.docs.teamAlpha;
  const contentOf = async (id: string) =>
    (
      await db
        .select({ content: schema.documentTable.content })
        .from(schema.documentTable)
        .where(eq(schema.documentTable.id, id))
    )[0]?.content;
  const versionsOf = async (id: string) =>
    db
      .select()
      .from(schema.documentVersionTable)
      .where(eq(schema.documentVersionTable.documentId, id));

  beforeEach(async () => {
    await resetTestDatabase();
    world = await buildDocumentWorld();
    process.env.S3_ENDPOINT = "https://storage.example.test";
    process.env.S3_BUCKET = "test-bucket";
    process.env.S3_ACCESS_KEY_ID = "test-access-key";
    process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
    delete process.env.S3_KEY_PREFIX;
    // A fake bucket: every write it is sent succeeds.
    vi.spyOn(S3Client.prototype, "send").mockResolvedValue({} as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores the bytes, records the assistant, and links the file in the text", async () => {
    const response = await attach(world.as(world.owner), doc(), fileBody());

    expect(response.status, await response.clone().text()).toBe(200);
    const payload = (await response.json()) as Stored;
    expect(payload).toMatchObject({
      kind: "attachment",
      mimeType: "application/pdf",
    });
    expect(payload.url.endsWith(`/asset/${payload.id}`)).toBe(true);

    expect(send()).toHaveBeenCalledTimes(1);
    const put = send().mock.calls[0]?.[0];
    expect(put).toBeInstanceOf(PutObjectCommand);
    const input = (put as PutObjectCommand).input;
    expect(input.Bucket).toBe("test-bucket");
    expect(input.Key?.startsWith(prefix(doc()))).toBe(true);
    expect(input.ContentType).toBe("application/pdf");
    expect(input.ContentLength).toBe(PDF.length);
    expect(Buffer.from(input.Body as Uint8Array).equals(PDF)).toBe(true);

    const { assets, files } = await rows();
    // One file: the document's own link to it is not copied again.
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      id: payload.id,
      documentId: doc(),
      projectId: null,
      taskId: null,
      objectKey: input.Key,
      filename: "Plan.pdf",
      mimeType: "application/pdf",
      size: PDF.length,
      kind: "attachment",
      surface: "document",
      createdBy: world.owner.id,
    });
    expect(files).toEqual([
      expect.objectContaining({
        assetId: payload.id,
        documentId: doc(),
        originalName: "Plan.pdf",
        sourceClient: "claude",
        sourceUserId: world.owner.id,
      }),
    ]);

    const content = await contentOf(doc());
    expect(content?.startsWith("<p>teamAlpha</p>")).toBe(true);
    expect(content).toContain(
      `<kaneo-attachment url="${payload.url}" filename="Plan.pdf" mime-type="application/pdf" size="${PDF.length}" />`,
    );
    // The history holds the text with the link, like any edit.
    expect((await versionsOf(doc())).map((v) => v.content)).toContain(content);
  });

  it("links a picture as an image, and stores no assistant when none is named", async () => {
    const response = await attach(
      world.as(world.owner),
      doc(),
      fileBody({ filename: "photo [1].png", sourceClient: undefined }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Stored;
    expect(payload.kind).toBe("image");
    expect(await contentOf(doc())).toContain(`![photo 1.png](${payload.url})`);
    expect((await rows()).files[0]?.sourceClient).toBeNull();
  });

  describe("refuses what it cannot store, before anything is written", () => {
    it.each([
      ["a type a document does not take", { filename: "run.exe" }, 415],
      ["bytes that are not base64", { contentBase64: "not base64!" }, 400],
      ["an empty file", { contentBase64: "" }, 400],
      [
        "a file over the chat limit",
        { contentBase64: Buffer.alloc(700_001).toString("base64") },
        400,
      ],
      ["the web as the sender", { sourceClient: "web" }, 400],
    ])("%s", async (_name, over, status) => {
      const response = await attach(
        world.as(world.owner),
        doc(),
        fileBody(over),
      );

      expect(response.status).toBe(status);
      expect(send()).not.toHaveBeenCalled();
      await expectNoRows();
    });
  });

  it("stays off and says so while storage is not configured", async () => {
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await attach(world.as(world.owner), doc(), fileBody());

    expect(response.status).toBe(503);
    expect(((await response.json()) as { message: string }).message).toBe(
      "File uploads are not configured on this instance.",
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("S3_ENDPOINT and S3_BUCKET"),
    );
    expect(send()).not.toHaveBeenCalled();
    await expectNoRows();
    expect(await contentOf(doc())).toBe("<p>teamAlpha</p>");
  });

  it("writes nothing when the bucket refuses the bytes", async () => {
    send().mockRejectedValue(new Error("bucket down"));

    const response = await attach(world.as(world.owner), doc(), fileBody());

    expect(response.status).toBe(503);
    await expectNoRows();
    expect(await contentOf(doc())).toBe("<p>teamAlpha</p>");
  });

  describe("who may attach", () => {
    const call = (request: Request, id: string) =>
      attach(request, id, fileBody());

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

      expect((await call(request, doc())).status).toBe(401);
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
      const trashed = await world.as(world.owner)(base(doc()), json("DELETE"));
      expect(trashed.status).toBe(200);

      expect((await call(world.as(world.owner), doc())).status).toBe(404);
      expect(send()).not.toHaveBeenCalled();
    });

    it("refuses a superseded document", async () => {
      await db
        .update(schema.documentTable)
        .set({ status: "superseded" })
        .where(eq(schema.documentTable.id, doc()));

      expect((await call(world.as(world.owner), doc())).status).toBe(409);
      expect(send()).not.toHaveBeenCalled();
    });

    const withKey = async (permissions: Record<string, string[]>) => {
      const { key } = await auth.api.createApiKey({
        body: { userId: world.owner.id, name: "Chat upload", permissions },
      });
      const asOwner = world.as(world.owner);
      mockAnonymousSession();
      return asOwner(`${base(doc())}/files`, {
        ...json("POST", fileBody()),
        headers: { "content-type": "application/json", "x-api-key": key },
      } as never);
    };

    it("refuses an API key that can only read", async () => {
      expect((await withKey({ task: ["read"] })).status).toBe(403);
      expect(send()).not.toHaveBeenCalled();
    });

    it("takes an API key that can update", async () => {
      expect((await withKey({ task: ["update"] })).status).toBe(200);
    });

    it("gives a member the same answer as editing the text", async () => {
      const edit = await world.as(world.open)(
        base(world.docs.teamAlpha),
        json("PATCH", { title: "x" }),
      );
      const attached = await call(world.as(world.open), world.docs.teamAlpha);

      expect([200, 403]).toContain(edit.status);
      expect(attached.status).toBe(edit.status);
    });
  });
});
