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
import {
  chatMessageFileTable,
  chatMessageTable,
} from "../../apps/api/src/database/schema";
import { settleEvents, subscribeToEvent } from "../../apps/api/src/events";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

type Request = ReturnType<DocumentWorld["as"]>;
type Sent = {
  id: string;
  body: string;
  files: { id: string; filename: string; mimeType: string }[];
};

const updated: string[] = [];
subscribeToEvent<{ messageId: string }>(
  "chat.message_updated",
  async ({ messageId }) => {
    updated.push(messageId);
  },
);

// A PNG and a PDF sent together: one message carries both, the image opens
// inline, the PDF downloads, and both sit where ticket attachments sit.
describe("API integration: chat attachments", () => {
  let world: DocumentWorld;
  let channels: { general: string; leads: string };

  const channelBase = () => `/chat/workspace/${world.ws}/channels`;
  const prefix = (channelId: string) =>
    `workspace/${world.ws}/chat/${channelId}/`;
  const send = () => vi.mocked(S3Client.prototype.send);
  const head = (ContentLength: number, ContentType: string) =>
    send().mockResolvedValueOnce({ ContentLength, ContentType });
  const finalize = (request: Request, channelId: string, body: unknown) =>
    request(
      `${channelBase()}/${channelId}/upload/finalize`,
      json("POST", body),
    );
  const sendFile = async (
    request: Request,
    channelId: string,
    filename: string,
    over: Record<string, unknown> = {},
  ) => {
    const type = filename.endsWith(".png") ? "image/png" : "application/pdf";
    head(1234, type);
    return finalize(request, channelId, {
      key: `${prefix(channelId)}${randomUUID()}-${filename}`,
      filename,
      size: 1234,
      ...over,
    });
  };
  const fileUrl = (channelId: string, fileId: string) =>
    `${channelBase()}/${channelId}/files/${fileId}`;
  const serve = (type: string) =>
    send().mockResolvedValueOnce({
      Body: { transformToWebStream: () => new Blob(["bytes"]).stream() },
      ContentType: type,
      ContentLength: 5,
    });
  const both = async (channelId: string) => {
    const first = await sendFile(
      world.as(world.owner),
      channelId,
      "chart.png",
      { body: "the numbers" },
    );
    expect(first.status, await first.clone().text()).toBe(200);
    const { id } = (await first.json()) as Sent;
    const second = await sendFile(
      world.as(world.owner),
      channelId,
      "report.pdf",
      { messageId: id },
    );
    expect(second.status, await second.clone().text()).toBe(200);
    return (await second.json()) as Sent;
  };

  beforeEach(async () => {
    await resetTestDatabase();
    updated.length = 0;
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
    await world.as(world.open)(
      `${channelBase()}/${channels.general}/join`,
      json("POST"),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("two files on one message", () => {
    it("adds the second file to the message and tells live clients", async () => {
      const message = await both(channels.general);

      expect(message.body).toBe("the numbers");
      expect(
        message.files.map(({ filename, mimeType }) => ({ filename, mimeType })),
      ).toEqual([
        { filename: "chart.png", mimeType: "image/png" },
        { filename: "report.pdf", mimeType: "application/pdf" },
      ]);
      expect(await db.select().from(chatMessageTable)).toHaveLength(1);
      await settleEvents();
      expect(updated).toEqual([message.id]);
    });

    it("queues both stored files for cleanup when the message goes", async () => {
      const message = await both(channels.general);
      const keys = (await db.select().from(chatMessageFileTable))
        .map((file) => file.objectKey)
        .sort();
      expect(keys).toHaveLength(2);

      const removed = await world.as(world.owner)(
        `${channelBase()}/${channels.general}/messages/${message.id}`,
        { method: "DELETE" } as ReturnType<typeof json>,
      );
      expect(removed.status).toBe(200);
      expect(await db.select().from(chatMessageFileTable)).toEqual([]);
      const queued = await db.select().from(schema.storageCleanupTable);
      expect(queued.map((row) => row.objectKey).sort()).toEqual(keys);
    });

    it("refuses to add a file to someone else's message", async () => {
      const first = await sendFile(
        world.as(world.owner),
        channels.general,
        "chart.png",
      );
      const { id } = (await first.json()) as Sent;

      const response = await sendFile(
        world.as(world.open),
        channels.general,
        "report.pdf",
        { messageId: id },
      );
      expect(response.status).toBe(403);
      expect(await db.select().from(chatMessageFileTable)).toHaveLength(1);
    });

    it("refuses a message from another channel", async () => {
      const first = await sendFile(
        world.as(world.owner),
        channels.leads,
        "chart.png",
      );
      const { id } = (await first.json()) as Sent;

      const response = await sendFile(
        world.as(world.owner),
        channels.general,
        "report.pdf",
        { messageId: id },
      );
      expect(response.status).toBe(404);
      expect(await db.select().from(chatMessageFileTable)).toHaveLength(1);
    });

    it("refuses text with a file added to a sent message", async () => {
      const first = await sendFile(
        world.as(world.owner),
        channels.general,
        "chart.png",
      );
      const { id } = (await first.json()) as Sent;

      const response = await sendFile(
        world.as(world.owner),
        channels.general,
        "report.pdf",
        { messageId: id, body: "more text" },
      );
      expect(response.status).toBe(400);
      expect(await db.select().from(chatMessageFileTable)).toHaveLength(1);
    });
  });

  it("serves the image inline and the PDF as a download", async () => {
    const message = await both(channels.general);
    const [image, pdf] = message.files;

    serve("image/png");
    const shown = await world.as(world.open)(
      fileUrl(channels.general, image?.id ?? ""),
    );
    expect(shown.status).toBe(200);
    expect(shown.headers.get("content-type")).toBe("image/png");
    expect(shown.headers.get("content-disposition")).toMatch(/^inline/);

    serve("application/pdf");
    const downloaded = await world.as(world.open)(
      fileUrl(channels.general, pdf?.id ?? ""),
    );
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("content-type")).toBe(
      "application/octet-stream",
    );
    expect(downloaded.headers.get("content-disposition")).toMatch(
      /^attachment; filename="report\.pdf"/,
    );
  });

  it("stores chat files in the bucket and prefix that ticket attachments use", async () => {
    process.env.S3_KEY_PREFIX = "kaneo-files";
    const chat = await world.as(world.owner)(
      `${channelBase()}/${channels.general}/upload`,
      json("PUT", { filename: "chart.png", size: 1234 }),
    );
    const ticket = await world.as(world.owner)(
      `/task/image-upload/${world.alphaTask.id}`,
      json("PUT", {
        filename: "chart.png",
        contentType: "image/png",
        size: 1234,
        surface: "attachment",
      }),
    );
    expect(chat.status).toBe(200);
    expect(ticket.status, await ticket.clone().text()).toBe(200);
    const [chatUpload, ticketUpload] = (await Promise.all([
      chat.json(),
      ticket.json(),
    ])) as { key: string; uploadUrl: string }[];
    const bucketOf = (url: string) => {
      const { origin, pathname } = new URL(url);
      return `${origin}${pathname.split("/").slice(0, 2).join("/")}`;
    };
    expect(bucketOf(chatUpload?.uploadUrl ?? "")).toBe(
      bucketOf(ticketUpload?.uploadUrl ?? ""),
    );
    const root = `kaneo-files/workspace/${world.ws}/`;
    expect(chatUpload?.key.startsWith(root)).toBe(true);
    expect(ticketUpload?.key.startsWith(root)).toBe(true);
  });

  describe("the file URL to people who cannot read the channel", () => {
    let fileId: string;
    const expectRefused = async (request: Request, channelId: string) => {
      const response = await request(fileUrl(channelId, fileId));
      expect(response.status).toBe(403);
    };

    beforeEach(async () => {
      const response = await sendFile(
        world.as(world.owner),
        channels.leads,
        "report.pdf",
      );
      fileId = ((await response.json()) as Sent).files[0]?.id ?? "";
    });

    it("refuses a workspace member outside a private channel", async () => {
      await expectRefused(world.as(world.open), channels.leads);
    });

    it("refuses someone outside the workspace", async () => {
      const { user: stranger } = await createWorkspaceMember();
      await expectRefused(world.as(stranger), channels.leads);
    });

    it("refuses a guest who was not added to a public channel", async () => {
      const message = (await (
        await sendFile(world.as(world.owner), channels.general, "lunch.pdf")
      ).json()) as Sent;
      fileId = message.files[0]?.id ?? "";
      await db
        .update(schema.workspaceMemberAccessTable)
        .set({ guest: true })
        .where(eq(schema.workspaceMemberAccessTable.userId, world.limited.id));
      await expectRefused(world.as(world.limited), channels.general);
    });

    it("refuses a workspace member outside a direct message", async () => {
      const dm = await world.as(world.owner)(
        `/chat/workspace/${world.ws}/direct-messages`,
        json("POST", { userIds: [world.limited.id] }),
      );
      const { id: dmId } = (await dm.json()) as { id: string };
      const message = (await (
        await sendFile(world.as(world.owner), dmId, "just-us.pdf")
      ).json()) as Sent;
      fileId = message.files[0]?.id ?? "";
      await expectRefused(world.as(world.open), dmId);
    });

    it("answers a missing channel the same way", async () => {
      await expectRefused(world.as(world.open), "no-such-channel");
    });

    it("still serves the file to a member of the channel", async () => {
      serve("application/pdf");
      const response = await world.as(world.owner)(
        fileUrl(channels.leads, fileId),
      );
      expect(response.status).toBe(200);
    });
  });
});
