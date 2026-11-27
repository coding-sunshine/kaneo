import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { reconcileCycles } from "../../apps/api/src/cycle/reconcile";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function setup() {
  const member = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const task = async (number: number, columnId: string, status: string) =>
    (
      await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          title: `Task ${number}`,
          status,
          columnId,
          priority: "medium",
          number,
          position: number,
        })
        .returning()
    )[0];
  const enable = (extra: object = {}) =>
    app.request(
      `/api/cycle/settings/${project.id}`,
      json("PUT", { cyclesEnabled: true, ...extra }),
    );
  return { app, member, project, columns, task, enable };
}

describe("API integration: cycles", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated access", async () => {
    mockAnonymousSession();
    const { app } = createApp();
    const response = await app.request("/api/cycle/project/x");
    expect(response.status).toBe(401);
  });

  it("creates the current and upcoming cycles when enabled, idempotently", async () => {
    const { app, project, enable } = await setup();
    expect((await enable({ cycleUpcomingCount: 2 })).status).toBe(200);

    const list = await (
      await app.request(`/api/cycle/project/${project.id}`)
    ).json();
    expect(list.map((c: { number: number }) => c.number).sort()).toEqual([
      1, 2, 3,
    ]);
    const [first] = [...list].sort(
      (a: { number: number }, b: { number: number }) => a.number - b.number,
    );
    expect(
      new Date(first.endsAt).getTime() - new Date(first.startsAt).getTime(),
    ).toBe(14 * 24 * 3600 * 1000);

    await reconcileCycles(project.id);
    const again = await (
      await app.request(`/api/cycle/project/${project.id}`)
    ).json();
    expect(again).toHaveLength(3);
  });

  it("sets and clears a task's cycle and refuses another team's cycle", async () => {
    const { app, member, project, columns, task, enable } = await setup();
    await enable();
    const [cycle] = await db.select().from(schema.cycleTable);
    const t = await task(1, columns.todo.id, "to-do");

    const set = await app.request(
      `/api/task/cycle/${t.id}`,
      json("PUT", { cycleId: cycle.id }),
    );
    expect(set.status).toBe(200);
    const detail = await (await app.request(`/api/task/${t.id}`)).json();
    expect(detail.cycleId).toBe(cycle.id);

    const cleared = await app.request(
      `/api/task/cycle/${t.id}`,
      json("PUT", { cycleId: null }),
    );
    expect(cleared.status).toBe(200);

    const { project: other } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Other team",
    });
    await app.request(
      `/api/cycle/settings/${other.id}`,
      json("PUT", { cyclesEnabled: true }),
    );
    const [foreign] = await db
      .select()
      .from(schema.cycleTable)
      .where(eq(schema.cycleTable.projectId, other.id));
    const refused = await app.request(
      `/api/task/cycle/${t.id}`,
      json("PUT", { cycleId: foreign.id }),
    );
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(project.id).not.toBe(other.id);
  });

  it("rolls unfinished issues into the next cycle when one ends", async () => {
    const { project, columns, task, enable } = await setup();
    await enable({ cycleAutoRollover: true });
    const [first] = (await db.select().from(schema.cycleTable)).sort(
      (a, b) => a.number - b.number,
    );
    const open = await task(1, columns.inProgress.id, "in-progress");
    const done = await task(2, columns.done.id, "done");
    await db
      .update(schema.taskTable)
      .set({ cycleId: first.id })
      .where(eq(schema.taskTable.projectId, project.id));

    await reconcileCycles(project.id, new Date(first.endsAt.getTime() + 1000));
    await reconcileCycles(project.id, new Date(first.endsAt.getTime() + 2000));

    const rows = await db.select().from(schema.taskTable);
    const byId = new Map(rows.map((r) => [r.id, r.cycleId]));
    expect(byId.get(done.id)).toBe(first.id);
    expect(byId.get(open.id)).not.toBe(first.id);
    expect(byId.get(open.id)).not.toBeNull();
    const [after] = await db
      .select()
      .from(schema.cycleTable)
      .where(eq(schema.cycleTable.id, first.id));
    expect(after.completedAt).not.toBeNull();
    const history = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.type, "cycle_changed"));
    expect(
      history.map((a) => [a.taskId, a.userId, a.externalUserName, a.eventData]),
    ).toEqual([
      [
        open.id,
        null,
        "Linear",
        { fromCycle: first.number, toCycle: first.number + 1 },
      ],
    ]);
  });

  it("snapshots a team summary when a cycle completes, with no per-person data", async () => {
    const { app, project, columns, task, enable } = await setup();
    await enable({ cycleAutoRollover: true });
    const [first, second] = (await db.select().from(schema.cycleTable)).sort(
      (a, b) => a.number - b.number,
    );
    const beforeStart = new Date(first.startsAt.getTime() - 24 * 3600 * 1000);
    const plan = async (number: number, columnId: string, status: string) => {
      const t = await task(number, columnId, status);
      await db
        .update(schema.taskTable)
        .set({ cycleId: first.id, cycleAddedAt: beforeStart })
        .where(eq(schema.taskTable.id, t.id));
      return t;
    };
    await plan(101, columns.done.id, "done");
    await plan(102, columns.inProgress.id, "in-progress");
    await plan(103, columns.todo.id, "canceled");
    // Added after start: one through the task cycle route, one on creation.
    const late = await task(104, columns.done.id, "done");
    await app.request(
      `/api/task/cycle/${late.id}`,
      json("PUT", { cycleId: first.id }),
    );
    const created = await app.request(
      `/api/task/${project.id}`,
      json("POST", {
        title: "Added later",
        description: "",
        status: "to-do",
        priority: "medium",
        cycleId: first.id,
      }),
    );
    expect(created.status).toBe(200);

    const open = await (await app.request(`/api/cycle/${first.id}`)).json();
    expect(open.summary).toBeNull();

    await reconcileCycles(project.id, new Date(first.endsAt.getTime() + 1000));
    const done = await (await app.request(`/api/cycle/${first.id}`)).json();
    expect(done.summary).toEqual({
      completed: 2,
      addedAfterStart: 2,
      carriedOver: 2,
    });

    // Rolled-over issues were planned for the next cycle, not added to it.
    await reconcileCycles(project.id, new Date(second.endsAt.getTime() + 1000));
    const next = await (await app.request(`/api/cycle/${second.id}`)).json();
    expect(next.summary).toEqual({
      completed: 0,
      addedAfterStart: 0,
      carriedOver: 2,
    });
  });

  it("hides a cycle and its summary from people outside the workspace", async () => {
    const { project, enable } = await setup();
    await enable();
    const [cycle] = await db
      .select()
      .from(schema.cycleTable)
      .where(eq(schema.cycleTable.projectId, project.id));
    const outsider = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();
    const response = await app.request(`/api/cycle/${cycle.id}`);
    expect([403, 404]).toContain(response.status);
    expect(await response.text()).not.toContain("summary");
  });
});
