import { randomUUID } from "node:crypto";
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
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { createReadSurfaceReader } from "./helpers/read-surface-reader";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

type Request = ReturnType<DocumentWorld["as"]>;
type Listed = {
  id: string;
  filename: string;
  url: string;
  addedBy: { id: string; name: string } | null;
  source: { kind: string; id: string; name: string };
};

describe("API integration: the file library", () => {
  let world: DocumentWorld;
  let channels: { general: string; leads: string };

  const channelBase = () => `/chat/workspace/${world.ws}/channels`;
  const prefix = (channelId: string) =>
    `workspace/${world.ws}/chat/${channelId}/`;
  const send = () => vi.mocked(S3Client.prototype.send);
  const head = (ContentLength: number, ContentType: string) =>
    send().mockResolvedValueOnce({ ContentLength, ContentType });
  const startUpload = (request: Request, channelId: string, body: unknown) =>
    request(`${channelBase()}/${channelId}/upload`, json("PUT", body));
  const finalize = (request: Request, channelId: string, body: unknown) =>
    request(
      `${channelBase()}/${channelId}/upload/finalize`,
      json("POST", body),
    );
  const finalizeBody = (
    channelId: string,
    filename: string,
    over: Record<string, unknown> = {},
  ) => ({
    key: `${prefix(channelId)}${randomUUID()}.pdf`,
    filename,
    size: 1234,
    ...over,
  });
  const postFile = async (channelId: string, filename: string) => {
    head(1234, "application/pdf");
    const response = await finalize(
      world.as(world.owner),
      channelId,
      finalizeBody(channelId, filename, { body: "see attached" }),
    );
    expect(response.status).toBe(200);
    return response.json() as Promise<{
      id: string;
      body: string;
      files: { id: string; filename: string; url: string }[];
    }>;
  };
  const ticketFile = (task: typeof world.alphaTask, filename: string) =>
    db
      .insert(schema.assetTable)
      .values({
        workspaceId: world.ws,
        projectId: task.projectId,
        taskId: task.id,
        objectKey: randomUUID(),
        filename,
        mimeType: "application/pdf",
        size: 3,
        kind: "attachment",
        surface: "attachment",
        createdBy: world.owner.id,
      })
      .returning();
  const documentFile = (documentId: string, filename: string) =>
    db
      .insert(schema.assetTable)
      .values({
        workspaceId: world.ws,
        documentId,
        objectKey: randomUUID(),
        filename,
        mimeType: "application/pdf",
        size: 3,
        kind: "attachment",
        surface: "document",
        createdBy: world.owner.id,
      })
      .returning();
  const list = async (request: Request, q?: string) => {
    const query = q ? `?q=${encodeURIComponent(q)}` : "";
    const response = await request(
      `/file-library/workspace/${world.ws}/files${query}`,
    );
    expect(response.status).toBe(200);
    return (await response.json()) as Listed[];
  };
  const names = (files: Listed[]) => files.map((file) => file.filename).sort();

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
    const create = async (name: string, isPrivate: boolean) => {
      const response = await world.as(world.owner)(
        channelBase(),
        json("POST", { name, isPrivate }),
      );
      return ((await response.json()) as { id: string }).id;
    };
    channels = {
      general: await create("general", false),
      leads: await create("leads", true),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists files from tickets, documents and chat with who added them and where", async () => {
    await ticketFile(world.alphaTask, "alpha-spec.pdf");
    await documentFile(world.docs.workspace, "handbook.pdf");
    const message = await postFile(channels.general, "minutes.pdf");
    expect(message.body).toBe("see attached");
    expect(message.files).toMatchObject([{ filename: "minutes.pdf" }]);

    const files = await list(world.as(world.owner));
    expect(names(files)).toEqual([
      "alpha-spec.pdf",
      "handbook.pdf",
      "minutes.pdf",
    ]);
    const byName = new Map(files.map((file) => [file.filename, file]));
    for (const file of files) {
      expect(file.addedBy).toEqual({
        id: world.owner.id,
        name: world.owner.name,
      });
      expect(file.url).toMatch(new RegExp(`/asset/${file.id}$`));
    }
    expect(byName.get("alpha-spec.pdf")?.source).toMatchObject({
      kind: "ticket",
      id: world.alphaTask.id,
      name: "Alpha issue",
    });
    expect(byName.get("handbook.pdf")?.source).toMatchObject({
      kind: "document",
      id: world.docs.workspace,
    });
    expect(byName.get("minutes.pdf")?.source).toMatchObject({
      kind: "chat",
      id: channels.general,
      name: "general",
      messageId: message.id,
    });
  });

  it("finds a file by its name, matching % and _ literally", async () => {
    await ticketFile(world.alphaTask, "Quarterly_Report.pdf");
    await ticketFile(world.alphaTask, "QuarterlyXReport.pdf");
    await documentFile(world.docs.workspace, "budget.pdf");

    expect(names(await list(world.as(world.owner), "quarterly_"))).toEqual([
      "Quarterly_Report.pdf",
    ]);
    expect(names(await list(world.as(world.owner), "BUDGET"))).toEqual([
      "budget.pdf",
    ]);
    expect(await list(world.as(world.owner), "%")).toEqual([]);
  });

  it("hides a private channel's file from non-members, even by exact name", async () => {
    const secret = await postFile(channels.leads, "salaries.pdf");
    await postFile(channels.general, "lunch.pdf");
    const fileId = secret.files[0]?.id ?? "";

    expect(names(await list(world.as(world.open)))).toEqual(["lunch.pdf"]);
    expect(await list(world.as(world.open), "salaries")).toEqual([]);

    const unknown = await world.as(world.open)("/asset/no-such-file");
    const hidden = await world.as(world.open)(`/asset/${fileId}`);
    expect(unknown.status).toBe(404);
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toEqual(await unknown.json());

    await world.as(world.owner)(
      `${channelBase()}/${channels.leads}/members`,
      json("POST", { userId: world.open.id }),
    );
    expect(names(await list(world.as(world.open)))).toEqual([
      "lunch.pdf",
      "salaries.pdf",
    ]);
  });

  it("hides a direct message's file from people outside it", async () => {
    const dm = await world.as(world.owner)(
      `/chat/workspace/${world.ws}/direct-messages`,
      json("POST", { userIds: [world.limited.id] }),
    );
    const { id: dmId } = (await dm.json()) as { id: string };
    await postFile(dmId, "just-us.pdf");

    expect(names(await list(world.as(world.limited)))).toEqual(["just-us.pdf"]);
    expect(await list(world.as(world.open))).toEqual([]);
  });

  it("hides files of tickets in teams the person cannot enter", async () => {
    await ticketFile(world.alphaTask, "alpha.pdf");
    await ticketFile(world.betaTask, "beta.pdf");

    expect(names(await list(world.as(world.limited)))).toEqual(["alpha.pdf"]);
    expect(await list(world.as(world.limited), "beta")).toEqual([]);
    expect(names(await list(world.as(world.open)))).toEqual([
      "alpha.pdf",
      "beta.pdf",
    ]);
  });

  it("hides files of documents the person cannot open and of deleted documents", async () => {
    await documentFile(world.docs.private, "private.pdf");
    await documentFile(world.docs.workspace, "shared.pdf");
    await documentFile(world.docs.teamBeta, "beta.pdf");

    expect(names(await list(world.as(world.limited)))).toEqual(["shared.pdf"]);

    await db
      .update(schema.documentTable)
      .set({ deletedAt: new Date() })
      .where(eq(schema.documentTable.id, world.docs.workspace));
    expect(await list(world.as(world.limited))).toEqual([]);
  });

  it("leaves out pasted images and staged uploads of tickets", async () => {
    await db.insert(schema.assetTable).values([
      {
        workspaceId: world.ws,
        projectId: world.alpha.id,
        taskId: world.alphaTask.id,
        objectKey: randomUUID(),
        filename: "pasted.png",
        mimeType: "image/png",
        size: 3,
        kind: "image",
        surface: "description",
        createdBy: world.owner.id,
      },
      {
        workspaceId: world.ws,
        projectId: world.alpha.id,
        objectKey: randomUUID(),
        filename: "staged.pdf",
        mimeType: "application/pdf",
        size: 3,
        kind: "attachment",
        surface: "draft",
        createdBy: world.owner.id,
      },
    ]);

    expect(await list(world.as(world.owner))).toEqual([]);
  });

  it("refuses someone outside the workspace", async () => {
    const { user: stranger } = await createWorkspaceMember();
    const response = await world.as(stranger)(
      `/file-library/workspace/${world.ws}/files`,
    );
    expect([403, 404]).toContain(response.status);
  });

  it("shows a guest only the files of channels they were added to", async () => {
    await postFile(channels.general, "lunch.pdf");
    const message = await postFile(channels.leads, "plan.pdf");
    await db
      .update(schema.workspaceMemberAccessTable)
      .set({ guest: true })
      .where(eq(schema.workspaceMemberAccessTable.userId, world.limited.id));

    expect(await list(world.as(world.limited))).toEqual([]);
    const hidden = await world.as(world.limited)(
      `/asset/${message.files[0]?.id}`,
    );
    expect(hidden.status).toBe(404);

    await world.as(world.owner)(
      `${channelBase()}/${channels.general}/members`,
      json("POST", { userId: world.limited.id }),
    );
    expect(names(await list(world.as(world.limited)))).toEqual(["lunch.pdf"]);
  });

  it("needs both issue and workspace read access, so a narrow key sees no channel files", async () => {
    const path = (ws: string) => `/api/file-library/workspace/${ws}/files`;
    const narrow = await createReadSurfaceReader("api-key", {
      task: ["read"],
    });
    const { app } = createApp();
    const refused = await app.request(path(narrow.workspace.id), {
      headers: narrow.headers,
    });
    expect(refused.status).toBe(403);

    const full = await createReadSurfaceReader("api-key", {
      task: ["read"],
      workspace: ["read"],
    });
    const allowed = await app.request(path(full.workspace.id), {
      headers: full.headers,
    });
    expect(allowed.status).toBe(200);
  });

  describe("sending a file in chat", () => {
    it("refuses a non-member of a private channel like a missing channel", async () => {
      for (const route of [startUpload, finalize]) {
        const response = await route(
          world.as(world.open),
          channels.leads,
          finalizeBody(channels.leads, "x.pdf"),
        );
        expect(response.status).toBe(404);
      }
      expect(await db.select().from(schema.assetTable)).toEqual([]);
    });

    it("refuses an archived channel", async () => {
      await world.as(world.owner)(
        `${channelBase()}/${channels.general}`,
        json("PATCH", { archived: true }),
      );
      head(1234, "application/pdf");
      const response = await finalize(
        world.as(world.owner),
        channels.general,
        finalizeBody(channels.general, "x.pdf"),
      );
      expect(response.status).toBe(409);
      expect(await db.select().from(schema.assetTable)).toEqual([]);
    });

    it("refuses a key issued for another channel", async () => {
      head(1234, "application/pdf");
      const response = await finalize(
        world.as(world.owner),
        channels.general,
        finalizeBody(channels.leads, "x.pdf", {
          key: `${prefix(channels.leads)}x.pdf`,
        }),
      );
      expect(response.status).toBe(400);
      expect(await db.select().from(schema.assetTable)).toEqual([]);
    });

    it("hands out an upload URL under the channel's own prefix", async () => {
      const response = await startUpload(
        world.as(world.owner),
        channels.general,
        { filename: "Plan.pdf", size: 1234 },
      );
      expect(response.status).toBe(200);
      const payload = (await response.json()) as { key: string };
      expect(payload.key.startsWith(prefix(channels.general))).toBe(true);
    });

    it("removes the file with its message", async () => {
      const message = await postFile(channels.general, "gone.pdf");
      const removed = await world.as(world.owner)(
        `${channelBase()}/${channels.general}/messages/${message.id}`,
        { method: "DELETE" } as ReturnType<typeof json>,
      );
      expect(removed.status).toBe(200);
      expect(await db.select().from(schema.assetTable)).toEqual([]);
      const queued = await db.select().from(schema.storageCleanupTable);
      expect(queued).toHaveLength(1);
    });
  });
});
