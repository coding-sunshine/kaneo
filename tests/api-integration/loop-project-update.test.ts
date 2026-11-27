import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { callTool, model, reply } from "./helpers/agent-model";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

// Every scripted reply reports 30 prompt and 20 completion tokens.
vi.mock("../../apps/api/src/agent/openrouter", async (original) => ({
  ...(await original<object>()),
  createCompletion: vi.fn(
    async (
      messages: never,
      _tools: unknown,
      _onText: unknown,
      onUsage?: (usage: object) => void,
    ) => {
      model.seen.push(messages);
      const next = model.queue.shift();
      if (!next) throw new Error("no scripted reply");
      onUsage?.({
        model: "test-model",
        promptTokens: 30,
        completionTokens: 20,
        cost: 0.001,
      });
      return next;
    },
  ),
}));

type User = typeof schema.userTable.$inferSelect;

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("API integration: loop drafts a project update", () => {
  const { app } = createApp();
  let owner: User;
  let member: User;
  let ws: string;
  let workProjectId: string;

  const as = (user: User) => {
    mockAuthenticatedSession(user);
    return app;
  };

  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
    const seeded = await createWorkspaceMember({ role: "owner" });
    owner = seeded.user;
    ws = seeded.workspace.id;
    member = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.id,
      role: "member",
      joinedAt: new Date(),
    });
    const [project] = await db
      .insert(schema.workProjectTable)
      .values({ workspaceId: ws, name: "Project X" })
      .returning();
    workProjectId = project?.id ?? "";
  });

  async function runLoop() {
    const created = await as(owner).request(
      "/api/loop",
      json("POST", {
        workspaceId: ws,
        name: "Weekly update",
        instructions: "summarize this week for project X",
        frequency: "weekly",
        actions: ["create_project_update"],
      }),
    );
    expect(created.status, await created.clone().text()).toBe(200);
    const loop = await created.json();
    model.queue.push(
      callTool("list_work_projects", { workspaceId: ws }),
      callTool("create_project_update", {
        workProjectId,
        health: "onTrack",
        body: "Search shipped; billing next.",
        reason: "Weekly summary the loop was asked for",
      }),
      reply("Drafted the update for you to accept on Pulse."),
    );
    const run = await as(owner).request(
      `/api/loop/workspace/${ws}/${loop.id}/run`,
      json("POST"),
    );
    expect(run.status, await run.clone().text()).toBe(200);
    expect((await run.json()).status).toBe("succeeded");
  }

  const drafts = async (user: User) => {
    const res = await as(user).request(
      `/api/agent/workspace/${ws}/proposals/drafts`,
    );
    expect(res.status).toBe(200);
    return (await res.json()) as {
      id: string;
      status: string;
      diff: { field: string; to: string | null }[];
    }[];
  };
  const updates = () => db.select().from(schema.workProjectUpdateTable);
  const accept = (user: User, id: string) =>
    as(user).request(
      `/api/agent/workspace/${ws}/proposals/${id}/accept`,
      json("POST"),
    );

  it("drafts the update without posting it, then posts it as the person who accepts", async () => {
    await runLoop();

    expect(await updates()).toEqual([]);
    const [draft, ...rest] = await drafts(owner);
    expect(rest).toEqual([]);
    expect(draft).toMatchObject({ status: "pending" });
    expect(draft?.diff).toEqual([
      { field: "project", from: null, to: "Project X" },
      { field: "health", from: null, to: "onTrack" },
      { field: "update", from: null, to: "Search shipped; billing next." },
    ]);

    const accepted = await accept(owner, draft?.id ?? "");
    expect(accepted.status, await accepted.clone().text()).toBe(200);
    expect((await accepted.json()).status).toBe("accepted");
    const posted = await updates();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      workProjectId,
      userId: owner.id,
      health: "onTrack",
      body: "Search shipped; billing next.",
    });
    expect((await accept(owner, draft?.id ?? "")).status).toBe(409);
    expect(await updates()).toHaveLength(1);

    const pulse = await (
      await as(owner).request(`/api/work-project/workspace/${ws}/updates`)
    ).json();
    expect(pulse[0]).toMatchObject({ userId: owner.id });
    expect(await drafts(owner)).toEqual([]);

    const audit = await (
      await as(owner).request(`/api/agent/workspace/${ws}/audit`)
    ).json();
    expect(audit[0]).toMatchObject({
      tool: "create_project_update",
      acceptedBy: { id: owner.id },
    });
  });

  it("counts the run's tokens on the usage page", async () => {
    await runLoop();
    const usage = await (
      await as(owner).request(`/api/agent/workspace/${ws}/usage`)
    ).json();
    const loop = usage.byFeature.find(
      (row: { feature: string }) => row.feature === "loop",
    );
    expect(loop?.tokens).toBe(150);
  });

  it("keeps another member from seeing or accepting the draft", async () => {
    await runLoop();
    const [draft] = await drafts(owner);
    expect(await drafts(member)).toEqual([]);
    expect((await accept(member, draft?.id ?? "")).status).toBe(404);
    expect(await updates()).toEqual([]);
  });

  it("refuses a draft for a project of another workspace", async () => {
    const other = await createWorkspaceMember({ role: "owner" });
    const [foreign] = await db
      .insert(schema.workProjectTable)
      .values({ workspaceId: other.workspace.id, name: "Elsewhere" })
      .returning();
    workProjectId = foreign?.id ?? "";
    await runLoop();
    expect(await drafts(owner)).toEqual([]);
    expect(await updates()).toEqual([]);
  });
});
