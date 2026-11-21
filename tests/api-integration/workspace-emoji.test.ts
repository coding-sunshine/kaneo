import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { deleteS3Object } from "../../apps/api/src/storage/s3";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/api/src/storage/s3")>()),
  deleteS3Object: vi.fn().mockResolvedValue(undefined),
  verifyTaskAssetUpload: vi.fn().mockResolvedValue(undefined),
}));

type Emoji = { id: string; name: string; url: string };

describe("API integration: workspace custom emoji", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.stubEnv("S3_ENDPOINT", "https://storage.example.test");
    vi.stubEnv("S3_BUCKET", "test-emoji");
    vi.stubEnv("S3_ACCESS_KEY_ID", "test-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "test-secret");
    vi.stubEnv("S3_KEY_PREFIX", "");
  });

  async function setup() {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const base = `/api/emoji/workspace/${owner.workspace.id}`;
    const send = (path: string, method: string, body?: unknown) =>
      app.request(`${base}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const create = (name: string, version = `v-${name}`) =>
      send("", "POST", {
        name,
        version,
        key: `workspace/${owner.workspace.id}/emoji/emoji-${version}`,
        contentType: "image/png",
        size: 1200,
      });
    return { owner, app, send, create };
  }

  it("creates, lists newest first, and rejects duplicate names", async () => {
    const { send, create } = await setup();
    expect((await create("party_parrot")).status).toBe(200);
    expect((await create("ship-it")).status).toBe(200);

    const list = (await (await send("", "GET")).json()) as Emoji[];
    expect(list.map((emoji) => emoji.name)).toEqual([
      "ship-it",
      "party_parrot",
    ]);
    expect(list[0].url).toContain("/image?v=v-ship-it");

    expect((await create("ship-it", "other")).status).toBe(409);
    const prepare = await send("/upload", "POST", {
      name: "ship-it",
      contentType: "image/png",
      size: 100,
    });
    expect(prepare.status).toBe(409);
  });

  it("validates name, type, size and the upload key", async () => {
    const { owner, send, create } = await setup();
    expect((await create("Bad Name")).status).toBe(400);
    expect((await create("")).status).toBe(400);
    const key = `workspace/${owner.workspace.id}/emoji/emoji-v1`;
    const body = { name: "ok", version: "v1", key, size: 10 };
    expect(
      (await send("", "POST", { ...body, contentType: "image/svg+xml" }))
        .status,
    ).toBe(400);
    expect(
      (
        await send("", "POST", {
          ...body,
          contentType: "image/png",
          size: 500_001,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await send("", "POST", {
          ...body,
          contentType: "image/png",
          key: "workspace/other/emoji/emoji-v1",
        })
      ).status,
    ).toBe(400);
  });

  it("deletes with workspace settings permission and removes the object", async () => {
    const { owner, app, send, create } = await setup();
    const created = (await (await create("gone")).json()) as Emoji;

    const member = await db
      .select()
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.workspaceId, owner.workspace.id));
    expect(member).toHaveLength(1);
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "member" })
      .where(eq(schema.workspaceUserTable.workspaceId, owner.workspace.id));
    expect((await send(`/${created.id}`, "DELETE")).status).toBe(403);

    await db
      .update(schema.workspaceUserTable)
      .set({ role: "owner" })
      .where(eq(schema.workspaceUserTable.workspaceId, owner.workspace.id));
    expect((await send(`/${created.id}`, "DELETE")).status).toBe(204);
    expect((await send(`/${created.id}`, "DELETE")).status).toBe(404);
    expect(deleteS3Object).toHaveBeenCalledWith(
      `workspace/${owner.workspace.id}/emoji/emoji-v-gone`,
    );
    expect(app).toBeDefined();
  });
});
