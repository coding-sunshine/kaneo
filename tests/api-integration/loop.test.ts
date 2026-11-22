import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { runDueLoops } from "../../apps/api/src/scheduler/loops";
import { callTool, model, reply } from "./helpers/agent-model";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/agent/openrouter", async (original) => ({
  ...(await original<object>()),
  createCompletion: vi.fn(async (messages: never) => {
    model.seen.push(messages);
    const next = model.queue.shift();
    if (!next) throw new Error("no scripted reply");
    return next;
  }),
}));

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: owner.workspace.id,
    name: "Loop project",
  });
  mockAuthenticatedSession(owner.user);
  const { app } = createApp();
  const created = await app.request(
    "/api/loop",
    json("POST", {
      workspaceId: owner.workspace.id,
      name: "Weekly wrap",
      instructions: "List the projects",
      frequency: "weekly",
    }),
  );
  expect(created.status).toBe(200);
  return { owner, project, app, loop: await created.json() };
}

const makeDue = (id: string) =>
  db
    .update(schema.loopTable)
    .set({ nextRunAt: new Date(Date.now() - 60_000) })
    .where(eq(schema.loopTable.id, id));

describe("API integration: loops", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
  });

  it("runs a due loop as its creator and records the transcript", async () => {
    const { owner, loop, app } = await setup();
    await makeDue(loop.id);
    model.queue.push(
      callTool("list_projects", { workspaceId: owner.workspace.id }),
      reply("One project"),
    );

    await runDueLoops();

    const runs = await db.select().from(schema.loopRunTable);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "succeeded", trigger: "schedule" });
    const transcript = JSON.stringify(runs[0]?.messages);
    expect(transcript).toContain("List the projects");
    expect(transcript).toContain("Loop project");

    const [after] = await db.select().from(schema.loopTable);
    expect(after?.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    const list = await (
      await app.request(
        `/api/loop/workspace/${owner.workspace.id}/${loop.id}/runs`,
      )
    ).json();
    expect(list).toHaveLength(1);

    // Not due again until its next window.
    await runDueLoops();
    expect(await db.select().from(schema.loopRunTable)).toHaveLength(1);
  });

  it("uses the creator's current permissions", async () => {
    const { owner, loop } = await setup();
    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, owner.user.id));
    await makeDue(loop.id);
    model.queue.push(
      callTool("list_projects", { workspaceId: owner.workspace.id }),
      reply("nothing"),
    );
    await runDueLoops();
    const [run] = await db.select().from(schema.loopRunTable);
    expect(JSON.stringify(run?.messages)).not.toContain("Loop project");
    expect(JSON.stringify(run?.messages)).toContain("error");
  });

  it("skips disabled loops and resumes them on enable", async () => {
    const { owner, loop, app } = await setup();
    const url = `/api/loop/workspace/${owner.workspace.id}/${loop.id}`;
    expect(
      (await app.request(url, json("PUT", { enabled: false }))).status,
    ).toBe(200);
    await makeDue(loop.id);
    await runDueLoops();
    expect(await db.select().from(schema.loopRunTable)).toHaveLength(0);

    await app.request(url, json("PUT", { enabled: true }));
    const [enabled] = await db.select().from(schema.loopTable);
    expect(enabled?.nextRunAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("lets only the creator run, edit or delete a loop", async () => {
    const { owner, loop, app } = await setup();
    const ws = owner.workspace.id;
    const other = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(other.user);
    const url = `/api/loop/workspace/${ws}/${loop.id}`;
    expect(
      await (await app.request(`/api/loop/workspace/${ws}`)).json(),
    ).toHaveLength(1);
    expect(
      await (await app.request(`/api/loop/workspace/${ws}?scope=mine`)).json(),
    ).toHaveLength(0);
    expect((await app.request(`${url}/run`, json("POST"))).status).toBe(403);
    expect((await app.request(url, json("PUT", { name: "x" }))).status).toBe(
      403,
    );
    expect((await app.request(url, json("DELETE"))).status).toBe(403);
    expect(model.seen).toHaveLength(0);

    const stranger = await createWorkspaceMember();
    mockAuthenticatedSession(stranger.user);
    expect((await app.request(url)).status).toBeGreaterThanOrEqual(403);
  });

  it("runs now for the creator and rejects forged internal credentials", async () => {
    const { owner, loop, app } = await setup();
    const ws = owner.workspace.id;
    model.queue.push(reply("ok"));
    const res = await app.request(
      `/api/loop/workspace/${ws}/${loop.id}/run`,
      json("POST"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "succeeded",
      trigger: "manual",
    });

    const forged = await app.request(`/api/loop/workspace/${ws}`, {
      headers: {
        "x-kaneo-internal-secret": "00".repeat(32),
        "x-kaneo-internal-user": owner.user.id,
      },
    });
    expect(forged.status).toBe(401);
  });
});
