import { asc, eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import "../../apps/api/src/activity";
import db, { schema } from "../../apps/api/src/database";
import { settleEvents } from "../../apps/api/src/events";
import { handleGiteaIssueLabeled } from "../../apps/api/src/plugins/gitea/webhooks/issue-labeled";
import { handleIssueLabeled } from "../../apps/api/src/plugins/github/webhooks/issue-labeled";
import { handleGitlabIssueUpdated } from "../../apps/api/src/plugins/gitlab/webhooks/issue-updated";
import deleteTask from "../../apps/api/src/task/controllers/delete-task";
import deleteTaskRelation from "../../apps/api/src/task-relation/controllers/delete-task-relation";
import assignLabelToTask from "../../apps/api/src/label/controllers/assign-label-to-task";
import unassignLabelFromTask from "../../apps/api/src/label/controllers/unassign-label-from-task";
import bulkUpdateTasks from "../../apps/api/src/task/controllers/bulk-update-tasks";
import updateTaskCycle from "../../apps/api/src/task/controllers/update-task-cycle";
import createTaskRelation from "../../apps/api/src/task-relation/controllers/create-task-relation";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const providers = vi.hoisted(() => ({ integrations: [] as unknown[] }));
vi.mock(
  "../../apps/api/src/plugins/github/services/task-service",
  async (original) => ({
    ...(await original<
      typeof import("../../apps/api/src/plugins/github/services/task-service")
    >()),
    findAllIntegrationsByRepo: async () => providers.integrations,
  }),
);
vi.mock(
  "../../apps/api/src/plugins/gitea/services/integration-lookup",
  async (original) => ({
    ...(await original<
      typeof import("../../apps/api/src/plugins/gitea/services/integration-lookup")
    >()),
    findAllIntegrationsByGiteaRepo: async () => providers.integrations,
  }),
);
vi.mock(
  "../../apps/api/src/plugins/gitlab/services/integration-lookup",
  async (original) => ({
    ...(await original<
      typeof import("../../apps/api/src/plugins/gitlab/services/integration-lookup")
    >()),
    findAllIntegrationsByGitlabProject: async () => providers.integrations,
  }),
);

beforeEach(resetTestDatabase);

async function setup() {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const task = async (number: number) =>
    (
      await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          title: `Task ${number}`,
          status: "to-do",
          priority: "low",
          number,
          position: number,
        })
        .returning()
    )[0];
  const history = async (taskId: string, type: string) => {
    await settleEvents();
    return db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, taskId))
      .orderBy(asc(schema.activityTable.createdAt))
      .then((rows) => rows.filter((row) => row.type === type));
  };
  return { user, workspace, project, task, history };
}

it("records cycle moves with the cycle numbers and the actor", async () => {
  const { user, project, task, history } = await setup();
  const [eight, nine] = await db
    .insert(schema.cycleTable)
    .values(
      [8, 9].map((number) => ({
        projectId: project.id,
        number,
        startsAt: new Date("2030-01-01"),
        endsAt: new Date("2030-01-15"),
      })),
    )
    .returning();
  const { id } = await task(1);

  await updateTaskCycle({ id, cycleId: eight.id, currentUserId: user.id });
  await updateTaskCycle({ id, cycleId: eight.id, currentUserId: user.id });
  await updateTaskCycle({ id, cycleId: nine.id, currentUserId: user.id });
  await updateTaskCycle({ id, cycleId: null, currentUserId: user.id });

  expect(
    (await history(id, "cycle_changed")).map((row) => [
      row.userId,
      row.eventData,
    ]),
  ).toEqual([
    [user.id, { fromCycle: null, toCycle: 8 }],
    [user.id, { fromCycle: 8, toCycle: 9 }],
    [user.id, { fromCycle: 9, toCycle: null }],
  ]);
});

it("records label additions and removals from single and bulk edits", async () => {
  const { user, workspace, task, history } = await setup();
  const [label] = await db
    .insert(schema.labelTable)
    .values({ name: "infra", color: "blue", workspaceId: workspace.id })
    .returning();
  const single = await task(1);
  const bulk = await task(2);

  const assigned = await assignLabelToTask(label.id, single.id, user.id);
  await unassignLabelFromTask(assigned.id, user.id);
  await bulkUpdateTasks({
    taskIds: [bulk.id],
    operation: "addLabel",
    value: label.id,
    userId: user.id,
  });

  expect(
    (await history(single.id, "labels_changed")).map((row) => row.eventData),
  ).toEqual([{ addedLabels: ["infra"] }, { removedLabels: ["infra"] }]);
  expect(
    (await history(bulk.id, "labels_changed")).map((row) => row.eventData),
  ).toEqual([{ addedLabels: ["infra"] }]);
});

it("records the parent issue on the subtask", async () => {
  const { user, workspace, project, task, history } = await setup();
  const parent = await task(1);
  const child = await task(2);

  await createTaskRelation({
    sourceTaskId: parent.id,
    targetTaskId: child.id,
    relationType: "subtask",
    userId: user.id,
    workspaceId: workspace.id,
  });

  expect(
    (await history(child.id, "parent_changed")).map((row) => row.eventData),
  ).toEqual([
    { fromParent: null, toParent: `${project.slug.toUpperCase()}-1` },
  ]);
  expect(await history(parent.id, "parent_changed")).toEqual([]);
});

it.each(["github", "gitea", "gitlab"] as const)(
  "records %s webhook label changes with the provider login",
  async (provider) => {
    const { project, task, history } = await setup();
    const { id } = await task(1);
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: provider,
        isActive: true,
        config: JSON.stringify({
          baseUrl: "https://git.example",
          repositoryOwner: "owner",
          repositoryName: "repo",
          accessToken: "fake-test-token",
        }),
      })
      .returning();
    providers.integrations = [integration];
    await db.insert(schema.externalLinkTable).values({
      taskId: id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: "https://git.example/owner/repo/issues/1",
      metadata: JSON.stringify({ syncFieldLabels: [] }),
    });
    const label = { name: "infra", color: "0000ff" };
    const send = async (action: "labeled" | "unlabeled") => {
      const labels = action === "labeled" ? [label] : [];
      if (provider === "gitlab")
        return handleGitlabIssueUpdated({
          object_attributes: {
            iid: 1,
            title: "Task 1",
            description: null,
            url: "https://git.example/owner/repo/-/issues/1",
            action: "update",
          },
          user: { username: "octo" },
          changes: {
            labels: {
              previous: action === "labeled" ? [] : [{ title: "infra" }],
              current: labels.map(({ name }) => ({ title: name })),
            },
          },
          project: {
            name: "repo",
            web_url: "https://git.example/owner/repo",
            path_with_namespace: "owner/repo",
          },
        } as Parameters<typeof handleGitlabIssueUpdated>[0]);
      const payload = {
        action,
        sender: { login: "octo" },
        issue: { number: 1, labels },
        label,
        repository: {
          id: 2,
          owner: { login: "owner" },
          name: "repo",
          html_url: "https://git.example/owner/repo",
        },
      };
      return provider === "github"
        ? handleIssueLabeled(payload)
        : handleGiteaIssueLabeled(payload);
    };

    await send("labeled");
    await send("labeled");
    await send("unlabeled");

    expect(
      (await history(id, "labels_changed")).map((row) => [
        row.userId,
        row.externalUserName,
        row.eventData,
      ]),
    ).toEqual([
      [null, "octo", { addedLabels: ["infra"] }],
      [null, "octo", { removedLabels: ["infra"] }],
    ]);
  },
);

it("records the old parent on sub-issues when the deleted parent goes", async () => {
  const { user, workspace, project, task, history } = await setup();
  const parent = await task(1);
  const bulkParent = await task(3);
  const child = await task(2);
  const bulkChild = await task(4);
  for (const [source, target] of [
    [parent, child],
    [bulkParent, bulkChild],
  ])
    await createTaskRelation({
      sourceTaskId: source.id,
      targetTaskId: target.id,
      relationType: "subtask",
      userId: user.id,
      workspaceId: workspace.id,
    });

  await deleteTask(parent.id, user.id);
  await bulkUpdateTasks({
    taskIds: [bulkParent.id],
    operation: "delete",
    userId: user.id,
  });

  const slug = project.slug.toUpperCase();
  for (const [task, number] of [
    [child, 1],
    [bulkChild, 3],
  ] as const)
    expect(
      (await history(task.id, "parent_changed")).map((row) => [
        row.userId,
        row.eventData,
      ]),
    ).toEqual([
      [user.id, { fromParent: null, toParent: `${slug}-${number}` }],
      [user.id, { fromParent: `${slug}-${number}`, toParent: null }],
    ]);
});

it("records the duplicate mark on the duplicate issue", async () => {
  const { user, workspace, project, task, history } = await setup();
  const original = await task(1);
  const copy = await task(2);

  const relation = await createTaskRelation({
    sourceTaskId: copy.id,
    targetTaskId: original.id,
    relationType: "duplicate",
    userId: user.id,
    workspaceId: workspace.id,
  });
  await deleteTaskRelation(relation.id, user.id, workspace.id);

  const slug = project.slug.toUpperCase();
  expect(
    (await history(copy.id, "duplicate_changed")).map((row) => row.eventData),
  ).toEqual([
    { fromDuplicate: null, toDuplicate: `${slug}-1` },
    { fromDuplicate: `${slug}-1`, toDuplicate: null },
  ]);
  expect(await history(original.id, "duplicate_changed")).toEqual([]);
});
