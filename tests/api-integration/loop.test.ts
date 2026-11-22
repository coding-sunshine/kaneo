import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { publishEvent } from "../../apps/api/src/events";
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
    expect(after?.nextRunAt?.getTime()).toBeGreaterThan(Date.now());
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
    expect(enabled?.nextRunAt?.getTime()).toBeGreaterThan(Date.now());
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

  const makeEventLoop = async (
    app: Awaited<ReturnType<typeof setup>>["app"],
    ws: string,
    body: object = {},
  ) => {
    const res = await app.request(
      "/api/loop",
      json("POST", {
        workspaceId: ws,
        name: "On new issue",
        instructions: "Assign an owner",
        trigger: "task_created",
        ...body,
      }),
    );
    expect(res.status).toBe(200);
    return res.json();
  };
  const runs = async (count: number) => {
    await vi.waitFor(async () => {
      const rows = await db.select().from(schema.loopRunTable);
      expect(rows.length).toBeGreaterThanOrEqual(count);
      expect(rows.every((r) => r.status !== "running")).toBe(true);
    });
    return db.select().from(schema.loopRunTable);
  };

  it("fires an event loop once per event, scoped to its project", async () => {
    const { owner, project, app } = await setup();
    const ws = owner.workspace.id;
    const other = await createProjectFixture({
      workspaceId: ws,
      name: "Other",
    });
    const created = await makeEventLoop(app, ws, { projectId: project.id });
    expect(created).toMatchObject({
      trigger: "task_created",
      frequency: null,
      nextRunAt: null,
      projectId: project.id,
    });

    model.queue.push(reply("done"));
    await publishEvent("task.created", {
      projectId: other.project.id,
      taskId: "t0",
    });
    await publishEvent("task.created", { projectId: project.id, taskId: "t1" });
    await publishEvent("task.created", { projectId: project.id, taskId: "t1" });
    const rows = await runs(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ trigger: "event", status: "succeeded" });
    expect(JSON.stringify(rows[0]?.messages)).toContain("task t1");
  });

  it("caps event runs per hour", async () => {
    const { owner, project, app } = await setup();
    const loop = await makeEventLoop(app, owner.workspace.id);
    await db.insert(schema.loopRunTable).values(
      Array.from({ length: 20 }, () => ({
        loopId: loop.id,
        trigger: "event" as const,
        status: "succeeded" as const,
      })),
    );
    await publishEvent("task.created", {
      projectId: project.id,
      taskId: "cap",
    });
    await new Promise((r) => setTimeout(r, 300));
    expect(await db.select().from(schema.loopRunTable)).toHaveLength(20);
    expect(model.seen).toHaveLength(0);
  });

  it("does not let a loop's own changes trigger loops", async () => {
    const { owner, project, app } = await setup();
    await makeEventLoop(app, owner.workspace.id);
    model.queue.push(reply("ok"));
    await publishEvent("task.created", { projectId: project.id, taskId: "a" });
    await runs(1);
    // A second loop run publishing inside its own context is ignored.
    const { loopRunContext } = await import("../../apps/api/src/loop/run-loop");
    await loopRunContext.run(true, () =>
      publishEvent("task.created", { projectId: project.id, taskId: "b" }),
    );
    await new Promise((r) => setTimeout(r, 300));
    expect(await db.select().from(schema.loopRunTable)).toHaveLength(1);
  });

  it("drafts a loop from text with one model call, saving nothing", async () => {
    const { owner, app } = await setup();
    model.queue.push(
      reply(
        JSON.stringify({
          name: "Triage bugs",
          instructions: "Label new bugs and assign an owner",
          trigger: "task_created",
          frequency: null,
        }),
      ),
    );
    const res = await app.request(
      "/api/loop/draft",
      json("POST", {
        workspaceId: owner.workspace.id,
        description: "triage new bugs",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      name: "Triage bugs",
      trigger: "task_created",
    });
    expect(model.seen).toHaveLength(1);
    expect(await db.select().from(schema.loopTable)).toHaveLength(1);

    model.queue.push(reply("not json"));
    const bad = await app.request(
      "/api/loop/draft",
      json("POST", { workspaceId: owner.workspace.id, description: "x" }),
    );
    expect(bad.status).toBe(502);
  });
});
