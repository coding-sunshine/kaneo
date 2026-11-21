import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const { taskTable } = schema;

async function times(id: string) {
  const [row] = await db
    .select({
      startedAt: taskTable.startedAt,
      completedAt: taskTable.completedAt,
      startedTriageAt: taskTable.startedTriageAt,
      triagedAt: taskTable.triagedAt,
    })
    .from(taskTable)
    .where(eq(taskTable.id, id));
  return row;
}

const set = (id: string, status: string) =>
  db.update(taskTable).set({ status }).where(eq(taskTable.id, id));

// Writes go straight to the table: the trigger, not a controller, owns the stamps.
describe("API integration: task status times", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("stamps Linear's workflow timestamps on every status write", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    await db.insert(schema.columnTable).values([
      { projectId: project.id, name: "Triage", slug: "triage", position: 9 },
      {
        projectId: project.id,
        name: "Canceled",
        slug: "canceled",
        position: 10,
      },
    ]);
    const [task] = await db
      .insert(taskTable)
      .values({ projectId: project.id, title: "Task", status: "triage" })
      .returning();
    const entered = await times(task.id);
    expect(entered.startedTriageAt).toBeInstanceOf(Date);
    expect(entered).toMatchObject({
      startedAt: null,
      completedAt: null,
      triagedAt: null,
    });

    await set(task.id, "in-progress");
    const started = await times(task.id);
    expect(started.startedAt).toBeInstanceOf(Date);
    expect(started.triagedAt).toBeInstanceOf(Date);
    expect(started.startedTriageAt).toEqual(entered.startedTriageAt);

    // Same workflow type, and a re-sent status: nothing moves.
    await set(task.id, "in-review");
    await set(task.id, "in-review");
    expect(await times(task.id)).toEqual(started);

    await set(task.id, "done");
    const done = await times(task.id);
    expect(done.completedAt).toBeInstanceOf(Date);
    expect(done.startedAt).toEqual(started.startedAt);

    // Canceled is final but not completed; started_at survives it.
    await set(task.id, "canceled");
    expect(await times(task.id)).toMatchObject({
      completedAt: null,
      startedAt: started.startedAt,
    });

    await set(task.id, "to-do");
    expect(await times(task.id)).toMatchObject({
      startedAt: null,
      completedAt: null,
      triagedAt: started.triagedAt,
    });

    // Back into triage: a new entry, and the last exit no longer holds.
    await set(task.id, "triage");
    const again = await times(task.id);
    expect(again.triagedAt).toBeNull();
    expect(again.startedTriageAt?.getTime()).toBeGreaterThanOrEqual(
      entered.startedTriageAt?.getTime() ?? 0,
    );
  });

  it("keeps the timestamps an import supplies", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const startedAt = new Date("2026-01-02T03:04:05Z");
    const completedAt = new Date("2026-01-05T03:04:05Z");
    const [task] = await db
      .insert(taskTable)
      .values({
        projectId: project.id,
        title: "Imported",
        status: "done",
        startedAt,
        completedAt,
      })
      .returning();
    expect(await times(task.id)).toMatchObject({ startedAt, completedAt });
  });
});
