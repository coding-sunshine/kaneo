import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

const DAY = 86_400_000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);

type Row = {
  id: string;
  lastUpdateAt: string | null;
  nextMilestone: { name: string; targetDate: string } | null;
  overdueCount: number;
};

describe("API integration: work project portfolio columns", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lists last update, next milestone and the overdue issues the reader can open", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const workspaceId = owner.workspace.id;
    const alpha = await createProjectFixture({ workspaceId, name: "Alpha" });
    const beta = await createProjectFixture({ workspaceId, name: "Beta" });
    const [active, quiet] = await db
      .insert(schema.workProjectTable)
      .values([
        { workspaceId, name: "Active" },
        { workspaceId, name: "Quiet" },
      ])
      .returning();

    await db.insert(schema.workProjectUpdateTable).values([
      {
        workProjectId: active.id,
        health: "onTrack",
        createdAt: daysFromNow(-9),
      },
      {
        workProjectId: active.id,
        health: "atRisk",
        createdAt: daysFromNow(-3),
      },
    ]);
    await db.insert(schema.workProjectMilestoneTable).values([
      { workProjectId: active.id, name: "Past", targetDate: daysFromNow(-2) },
      { workProjectId: active.id, name: "Later", targetDate: daysFromNow(10) },
      { workProjectId: active.id, name: "Next", targetDate: daysFromNow(5) },
      { workProjectId: active.id, name: "Undated" },
    ]);
    let number = 0;
    const task = (
      projectId: string,
      status: string,
      dueDate: Date | null,
      title: string,
    ) => ({
      projectId,
      status,
      dueDate,
      title,
      number: ++number,
      workProjectId: active.id,
    });
    await db.insert(schema.taskTable).values([
      task(alpha.project.id, "to-do", daysFromNow(-1), "Late in alpha"),
      task(alpha.project.id, "done", daysFromNow(-4), "Late but done"),
      task(alpha.project.id, "in-progress", daysFromNow(3), "Not due yet"),
      task(alpha.project.id, "to-do", null, "No due date"),
      // Due later today: not overdue until the due time passes.
      task(alpha.project.id, "to-do", daysFromNow(1 / 24), "Due in an hour"),
      task(beta.project.id, "to-do", daysFromNow(-2), "Late in beta"),
    ]);

    const list = async () => {
      const response = await createApp().app.request(
        `/api/work-project/workspace/${workspaceId}`,
      );
      expect(response.status).toBe(200);
      const rows = (await response.json()) as Row[];
      return new Map(rows.map((row) => [row.id, row]));
    };

    mockAuthenticatedSession(owner.user);
    const asOwner = await list();
    const activeRow = asOwner.get(active.id);
    expect(activeRow?.overdueCount).toBe(2);
    expect(activeRow?.nextMilestone?.name).toBe("Next");
    expect(
      Math.abs(
        Date.parse(activeRow?.nextMilestone?.targetDate ?? "") -
          daysFromNow(5).getTime(),
      ),
    ).toBeLessThan(60_000);
    expect(
      Math.abs(
        Date.parse(activeRow?.lastUpdateAt ?? "") - daysFromNow(-3).getTime(),
      ),
    ).toBeLessThan(60_000);
    expect(asOwner.get(quiet.id)).toMatchObject({
      lastUpdateAt: null,
      nextMilestone: null,
      overdueCount: 0,
    });

    // A member who can open only Alpha does not count Beta's late issue.
    const member = await addWorkspaceMember(workspaceId);
    await restrictToProjects(workspaceId, member.id, [alpha.project.id]);
    mockAuthenticatedSession(member);
    expect((await list()).get(active.id)?.overdueCount).toBe(1);
  });
});
