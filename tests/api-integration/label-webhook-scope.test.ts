import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { writeImportLabels } from "../../apps/api/src/import/writer/write-import-labels";
import { handleGiteaIssueLabeled } from "../../apps/api/src/plugins/gitea/webhooks/issue-labeled";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<typeof import("../../apps/api/src/events")>()),
  publishEvent: vi.fn(async () => undefined),
}));

beforeEach(resetTestDatabase);

async function setup() {
  const member = await createWorkspaceMember({ role: "owner" });
  const workspaceId = member.workspace.id;
  const { project: teamA } = await createProjectFixture({ workspaceId });
  const { project: teamB } = await createProjectFixture({ workspaceId });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: teamA.id, title: "T", number: 1 })
    .returning();
  const def = (name: string, projectId: string | null) =>
    db
      .insert(schema.labelTable)
      .values({ name, color: "red", workspaceId, taskId: null, projectId });
  await def("other-team", teamB.id);
  await def("own-team", teamA.id);
  await def("shared", null);
  const onTask = async () =>
    (
      await db
        .select()
        .from(schema.labelTable)
        .where(eq(schema.labelTable.taskId, task.id))
    )
      .map((l) => l.name)
      .sort();
  return { workspaceId, teamA, task, onTask };
}

describe("name-matched labels never cross teams", () => {
  it("importer attaches workspace and own-team labels, not another team's", async () => {
    const { workspaceId, task, onTask } = await setup();
    const labels = ["other-team", "own-team", "shared"].map((name) => ({
      key: name,
      name,
    }));
    await db.transaction((tx) =>
      writeImportLabels(tx, workspaceId, labels, [
        { id: task.id, labelKeys: labels.map((l) => l.key) },
      ]),
    );
    expect(await onTask()).toEqual(["own-team", "shared"]);
  });

  it("gitea webhook skips another team's label by name", async () => {
    const { teamA, task, onTask } = await setup();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: teamA.id,
        type: "gitea",
        config: JSON.stringify({
          baseUrl: "https://gitea.example",
          accessToken: "fake-test-token",
          repositoryOwner: "owner",
          repositoryName: "repo",
        }),
      })
      .returning();
    await db.insert(schema.externalLinkTable).values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: "https://gitea.example/owner/repo/issues/1",
    });
    const repository = {
      owner: { login: "owner" },
      name: "repo",
      html_url: "https://gitea.example/owner/repo",
    };
    for (const name of ["other-team", "shared"])
      await handleGiteaIssueLabeled(
        {
          action: "labeled",
          issue: { number: 1, labels: [{ name }] },
          label: { name, color: "ff0000" },
          repository,
        },
        integration.id,
      );
    expect(await onTask()).not.toContain("other-team");
    expect(await onTask()).toContain("shared");
  });
});
