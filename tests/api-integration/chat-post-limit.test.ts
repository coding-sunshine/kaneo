import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type Seeded = Awaited<ReturnType<typeof createWorkspaceMember>>;

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const teammate = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: owner.workspace.id,
    userId: teammate.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  const { app } = createApp();
  const base = `/api/chat/workspace/${owner.workspace.id}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const create = async (name: string) =>
    (await (await as(owner)(base, json("POST", { name }))).json()) as {
      id: string;
    };
  const general = await create("general");
  const random = await create("random");
  await as(teammate)(`${base}/${general.id}/join`, json("POST"));
  const post = (member: Seeded, channelId: string, body: unknown) =>
    as(member)(`${base}/${channelId}/messages`, json("POST", body));
  return { owner, teammate, general, random, post };
}

describe("API integration: chat post limit", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("answers 429 once one person floods a channel, replies included", async () => {
    const { owner, general, post } = await setup();
    const first = await post(owner, general.id, { body: "start" });
    expect(first.status).toBe(200);
    const parent = (await first.json()) as { id: string };
    for (let i = 1; i < 20; i++) {
      const sent = await post(
        owner,
        general.id,
        i % 2 ? { body: `reply ${i}`, parentId: parent.id } : { body: `${i}` },
      );
      expect(sent.status).toBe(200);
    }

    for (const body of [
      { body: "one too many" },
      { body: "reply too many", parentId: parent.id },
    ]) {
      const limited = await post(owner, general.id, body);
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    }
  });

  it("leaves other people and other channels unaffected", async () => {
    const { owner, teammate, general, random, post } = await setup();
    for (let i = 0; i < 20; i++)
      expect((await post(owner, general.id, { body: `${i}` })).status).toBe(
        200,
      );
    expect((await post(owner, general.id, { body: "flood" })).status).toBe(429);

    expect((await post(teammate, general.id, { body: "hi" })).status).toBe(200);
    expect((await post(owner, random.id, { body: "hi" })).status).toBe(200);
  });
});
