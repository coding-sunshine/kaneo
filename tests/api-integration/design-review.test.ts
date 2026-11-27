import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type ReviewQueue = {
  tasks: Array<{
    id: string;
    reviewRequestedAt: string | null;
    reviewSlaDueAt: string | null;
  }>;
  total: number;
};

async function joinWorkspace(
  workspaceId: string,
  role = "member",
  userName = "Second Member",
) {
  const { user } = await createWorkspaceMember({ userName });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });
  return user;
}

async function seed() {
  // The owner can open private teams, so it can still request reviews there.
  const requester = await createWorkspaceMember({
    userName: "Requester",
    role: "owner",
  });
  const workspaceId = requester.workspace.id;
  const reviewer = await joinWorkspace(workspaceId, "viewer", "Reviewer");
  const bystander = await joinWorkspace(workspaceId, "member", "Bystander");
  const { project, columns } = await createProjectFixture({ workspaceId });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Checkout redesign",
      status: "to-do",
      columnId: columns.todo.id,
      priority: "medium",
      position: 1,
      number: 1,
    })
    .returning();
  return { requester, reviewer, bystander, project, task, workspaceId };
}

function as(user: Parameters<typeof mockAuthenticatedSession>[0]) {
  mockAuthenticatedSession(user);
  const { app } = createApp();
  return (path: string, init?: { method?: string; body?: unknown }) =>
    app.request(`/api${path}`, {
      method: init?.method ?? "GET",
      headers: init?.body ? { "Content-Type": "application/json" } : {},
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
}

async function reviewQueue(
  request: ReturnType<typeof as>,
  workspaceId: string,
) {
  const response = await request(
    `/task/assigned?workspaceId=${workspaceId}&tab=review`,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as ReviewQueue;
}

describe("API integration: design review", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("puts a requested review in the reviewer's queue until they approve it", async () => {
    const { requester, reviewer, bystander, task, workspaceId } = await seed();

    const created = await as(requester.user)(`/design-review/task/${task.id}`, {
      method: "POST",
      body: { reviewerId: reviewer.id },
    });
    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({
      reviewerId: reviewer.id,
      requesterId: requester.user.id,
      status: "pending",
    });

    const listed = await as(bystander)(`/design-review/task/${task.id}`);
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject([
      { reviewerId: reviewer.id, reviewerName: "Reviewer", status: "pending" },
    ]);

    const queue = await reviewQueue(as(reviewer), workspaceId);
    expect(queue.total).toBe(1);
    expect(queue.tasks[0]?.id).toBe(task.id);
    const requestedAt = new Date(queue.tasks[0]?.reviewRequestedAt ?? "");
    const slaDueAt = new Date(queue.tasks[0]?.reviewSlaDueAt ?? "");
    expect(slaDueAt.getTime() - requestedAt.getTime()).toBe(
      2 * 24 * 60 * 60 * 1000,
    );

    // Someone else's review request is not in the bystander's queue.
    expect((await reviewQueue(as(bystander), workspaceId)).total).toBe(0);

    const approved = await as(reviewer)(
      `/design-review/task/${task.id}/approve`,
      { method: "POST" },
    );
    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({ status: "approved" });

    expect((await reviewQueue(as(reviewer), workspaceId)).total).toBe(0);
  });

  it("lets only the named reviewer approve", async () => {
    const { requester, reviewer, bystander, task } = await seed();
    await as(requester.user)(`/design-review/task/${task.id}`, {
      method: "POST",
      body: { reviewerId: reviewer.id },
    });

    for (const user of [bystander, requester.user]) {
      const response = await as(user)(
        `/design-review/task/${task.id}/approve`,
        { method: "POST" },
      );
      expect(response.status).toBe(404);
    }
    const [row] = await db
      .select({ status: schema.taskDesignReviewTable.status })
      .from(schema.taskDesignReviewTable)
      .where(eq(schema.taskDesignReviewTable.taskId, task.id));
    expect(row?.status).toBe("pending");
  });

  it("needs task:update to request or withdraw a review", async () => {
    const { requester, reviewer, bystander, task } = await seed();

    const denied = await as(reviewer)(`/design-review/task/${task.id}`, {
      method: "POST",
      body: { reviewerId: bystander.id },
    });
    expect(denied.status).toBe(403);

    await as(requester.user)(`/design-review/task/${task.id}`, {
      method: "POST",
      body: { reviewerId: reviewer.id },
    });
    const withdrawDenied = await as(reviewer)(
      `/design-review/task/${task.id}/reviewer/${reviewer.id}`,
      { method: "DELETE" },
    );
    expect(withdrawDenied.status).toBe(403);

    const withdrawn = await as(requester.user)(
      `/design-review/task/${task.id}/reviewer/${reviewer.id}`,
      { method: "DELETE" },
    );
    expect(withdrawn.status).toBe(200);
    const rows = await db
      .select()
      .from(schema.taskDesignReviewTable)
      .where(eq(schema.taskDesignReviewTable.taskId, task.id));
    expect(rows).toHaveLength(0);
  });

  it("rejects a reviewer who cannot open the task", async () => {
    const { requester, reviewer, project, task } = await seed();
    const outsider = await createWorkspaceMember({ userName: "Outsider" });

    const notMember = await as(requester.user)(
      `/design-review/task/${task.id}`,
      { method: "POST", body: { reviewerId: outsider.user.id } },
    );
    expect(notMember.status).toBe(400);

    await db
      .update(schema.projectTable)
      .set({ isPrivate: true })
      .where(eq(schema.projectTable.id, project.id));
    const noProjectAccess = await as(requester.user)(
      `/design-review/task/${task.id}`,
      { method: "POST", body: { reviewerId: reviewer.id } },
    );
    expect(noProjectAccess.status).toBe(400);
  });

  it("hides a task's reviews from people outside its workspace or team", async () => {
    const { requester, reviewer, project, task, workspaceId } = await seed();
    await as(requester.user)(`/design-review/task/${task.id}`, {
      method: "POST",
      body: { reviewerId: reviewer.id },
    });
    const outsider = await createWorkspaceMember({ userName: "Outsider" });

    const outsiderList = await as(outsider.user)(
      `/design-review/task/${task.id}`,
    );
    expect([403, 404]).toContain(outsiderList.status);
    const outsiderApprove = await as(outsider.user)(
      `/design-review/task/${task.id}/approve`,
      { method: "POST" },
    );
    expect([403, 404]).toContain(outsiderApprove.status);
    const outsiderRequest = await as(outsider.user)(
      `/design-review/task/${task.id}`,
      { method: "POST", body: { reviewerId: outsider.user.id } },
    );
    expect([403, 404]).toContain(outsiderRequest.status);
    const outsiderWithdraw = await as(outsider.user)(
      `/design-review/task/${task.id}/reviewer/${reviewer.id}`,
      { method: "DELETE" },
    );
    expect([403, 404]).toContain(outsiderWithdraw.status);

    // Losing access to the team drops the request from the reviewer's queue
    // and blocks approving it.
    await db
      .update(schema.projectTable)
      .set({ isPrivate: true })
      .where(eq(schema.projectTable.id, project.id));
    expect((await reviewQueue(as(reviewer), workspaceId)).total).toBe(0);
    const closedApprove = await as(reviewer)(
      `/design-review/task/${task.id}/approve`,
      { method: "POST" },
    );
    expect(closedApprove.status).toBe(403);
  });
});
