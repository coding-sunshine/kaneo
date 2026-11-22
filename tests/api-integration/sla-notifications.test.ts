import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import "../../apps/api/src/notification";
import db, { schema } from "../../apps/api/src/database";
import { projectTriageResponsibleTable } from "../../apps/api/src/database/schema";
import { checkSlaNotifications } from "../../apps/api/src/scheduler/sla-notifications";
import { applySla } from "../../apps/api/src/team-automation/sla";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

const NOW = new Date("2026-06-01T12:00:00Z");
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

async function setup(opts: { assignee?: boolean; dueIn?: number | null } = {}) {
  const { user, workspace } = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Late",
      number: 1,
      columnId: columns.todo.id,
      userId: opts.assignee === false ? null : user.id,
      slaDueAt: opts.dueIn === null ? null : minutes(opts.dueIn ?? 30),
    })
    .returning();
  return { user, project, columns, task };
}

async function types(userId?: string) {
  const rows = await db.select().from(schema.notificationTable);
  return rows
    .filter((r) => !userId || r.userId === userId)
    .map((r) => r.type)
    .sort();
}

describe("sla notifications", () => {
  it("warns within an hour, once", async () => {
    const { user } = await setup({ dueIn: 30 });
    await checkSlaNotifications(NOW);
    await checkSlaNotifications(minutes(5));
    expect(await types(user.id)).toEqual(["sla_warning"]);
  });

  it("does not warn when the deadline is more than an hour away", async () => {
    await setup({ dueIn: 90 });
    await checkSlaNotifications(NOW);
    expect(await types()).toEqual([]);
  });

  it("breaches once past due, after a warning, with no repeat", async () => {
    const { user } = await setup({ dueIn: 30 });
    await checkSlaNotifications(NOW);
    await checkSlaNotifications(minutes(31));
    await checkSlaNotifications(minutes(60));
    expect(await types(user.id)).toEqual(["sla_breach", "sla_warning"]);
  });

  it("sends only the breach for a task already overdue", async () => {
    const { user } = await setup({ dueIn: -10 });
    await checkSlaNotifications(NOW);
    expect(await types(user.id)).toEqual(["sla_breach"]);
  });

  it("falls back to triage responsibles when unassigned", async () => {
    const { project } = await setup({ assignee: false, dueIn: 30 });
    const triager = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: project.workspaceId,
      userId: triager.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    await db.insert(projectTriageResponsibleTable).values({
      projectId: project.id,
      userId: triager.user.id,
    });
    await checkSlaNotifications(NOW);
    expect(await types(triager.user.id)).toEqual(["sla_warning"]);
    expect(await types()).toHaveLength(1);
  });

  it("skips done tasks and tasks without a deadline", async () => {
    const a = await setup({ dueIn: -10 });
    await db
      .update(schema.taskTable)
      .set({ status: "done" })
      .where(eq(schema.taskTable.id, a.task.id));
    await setup({ dueIn: null });
    await checkSlaNotifications(NOW);
    expect(await types()).toEqual([]);
  });

  it("resets both stages when the deadline changes", async () => {
    const { project, task, user } = await setup({ dueIn: -10 });
    await db
      .update(schema.projectTable)
      .set({ slaEnabled: true, slaUrgentHours: 4, slaHighHours: 24 })
      .where(eq(schema.projectTable.id, project.id));
    await checkSlaNotifications(NOW);
    const [stamped] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(stamped.slaBreachedAt).not.toBeNull();

    await applySla(task.id, "urgent");
    const [reset] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(reset.slaBreachedAt).toBeNull();
    expect(reset.slaWarningNotifiedAt).toBeNull();

    const later = new Date((reset.slaDueAt as Date).getTime() + 60_000);
    await checkSlaNotifications(later);
    expect(await types(user.id)).toEqual(["sla_breach", "sla_breach"]);
  });
});
