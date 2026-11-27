import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { model, reply } from "./helpers/agent-model";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { createTaskFixture } from "./helpers/project-access/create-task-fixture";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

vi.mock("../../apps/api/src/agent/openrouter", async (original) => ({
  ...(await original<object>()),
  createCompletion: vi.fn(async (messages: never) => {
    model.seen.push(messages);
    const next = model.queue.shift();
    if (!next) throw new Error("no scripted reply");
    return next;
  }),
}));

type User = typeof schema.userTable.$inferSelect;

describe("API integration: ticket summary", () => {
  const { app } = createApp();
  let owner: User;
  let ws: string;
  let project: Awaited<ReturnType<typeof createProjectFixture>>;
  let task: typeof schema.taskTable.$inferSelect;
  let commentIds: string[];

  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
    const member = await createWorkspaceMember({ role: "owner" });
    owner = member.user;
    ws = member.workspace.id;
    project = await createProjectFixture({ workspaceId: ws });
    task = await createTaskFixture(project, "Checkout fails", owner.id);
    const rows = await db
      .insert(schema.activityTable)
      .values(
        Array.from({ length: 12 }, (_, index) => ({
          taskId: task.id,
          type: "comment",
          userId: owner.id,
          content: `Comment number ${index + 1}`,
          createdAt: new Date(Date.UTC(2026, 10, 1, 9, index)),
        })),
      )
      .returning({ id: schema.activityTable.id });
    commentIds = rows.map((row) => row.id);
  });

  const summarise = (user: User, taskId = task.id) => {
    mockAuthenticatedSession(user);
    return app.request(`/api/agent/workspace/${ws}/tasks/${taskId}/summary`, {
      method: "POST",
    });
  };
  const ticket = async () =>
    (
      await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.id, task.id))
    )[0];

  it("summarises the ticket and its 12 comments with links to the comments it used, changing nothing", async () => {
    const before = await ticket();
    model.queue.push(
      reply(
        JSON.stringify({
          currentState: "Payment works again; waiting for a deploy.",
          blockers: ["Deploy is frozen until Monday"],
          comments: [commentIds[3], commentIds[11], "made-up-id"],
        }),
      ),
    );
    const res = await summarise(owner);
    expect(res.status, await res.clone().text()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      currentState: "Payment works again; waiting for a deploy.",
      blockers: ["Deploy is frozen until Monday"],
    });
    expect(
      body.sources.map((source: { id: string; kind: string }) => [
        source.kind,
        source.id,
      ]),
    ).toEqual([
      ["comment", commentIds[3]],
      ["comment", commentIds[11]],
    ]);
    expect(body.sources[0]).toMatchObject({
      restricted: false,
      taskId: task.id,
      projectId: project.project.id,
    });
    // The model read every comment, as data.
    const sent = JSON.stringify(model.seen[0]);
    for (const id of commentIds) expect(sent).toContain(id);
    expect(sent).toContain("Comment number 12");
    expect(await ticket()).toEqual(before);
  });

  it("refuses a ticket in a team the person cannot open, before asking the model", async () => {
    const other = await createProjectFixture({ workspaceId: ws });
    const member = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.id,
      role: "member",
      joinedAt: new Date(),
    });
    await restrictToProjects(ws, member.id, [other.project.id]);
    const res = await summarise(member);
    expect(res.status).toBe(404);
    expect(model.seen).toHaveLength(0);
  });

  it("refuses a ticket of another workspace", async () => {
    const stranger = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(stranger.user);
    const res = await app.request(
      `/api/agent/workspace/${stranger.workspace.id}/tasks/${task.id}/summary`,
      { method: "POST" },
    );
    expect(res.status).toBe(404);
    expect(model.seen).toHaveLength(0);
  });

  it("is off without a model key", async () => {
    delete process.env.OPENROUTER_API_KEY;
    expect((await summarise(owner)).status).toBe(404);
  });
});
