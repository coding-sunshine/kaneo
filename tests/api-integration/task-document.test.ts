import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  activityTable,
  documentTable,
  taskDocumentTable,
  topicTable,
} from "../../apps/api/src/database/schema";
import { handleGiteaIssueOpened } from "../../apps/api/src/plugins/gitea/webhooks/issue-opened";
import { handleIssueCommentCreated } from "../../apps/api/src/plugins/github/webhooks/issue-comment-created";
import { handleIssueOpened } from "../../apps/api/src/plugins/github/webhooks/issue-opened";
import { handleGitlabIssueOpened } from "../../apps/api/src/plugins/gitlab/webhooks/issue-opened";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { createTaskFixture } from "./helpers/project-access/create-task-fixture";

// The providers' own APIs, which a webhook calls back after it wrote the issue.
const provider = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({
    getInstallationOctokit: async () => ({
      rest: { issues: { createComment: provider.write } },
    }),
  }),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({ createIssueComment: provider.write }),
}));
vi.mock("../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({ createIssueNote: provider.write }),
}));

type Member = DocumentWorld["owner"];
type Task = DocumentWorld["alphaTask"];
type Listed = {
  id: string;
  title: string;
  status: string;
  currentDocumentId: string | null;
};
type Cited = {
  id: string;
  title: string;
  number: number;
  projectId: string;
  projectSlug: string;
};

const REASON = "The launch date moved, and this one says so.";
const base = (world: DocumentWorld) => `/document/workspace/${world.ws}`;
const documentAddress = (workspaceId: string, id: string) =>
  `https://tracker.example/dashboard/workspace/${workspaceId}/document/${id}`;
const linkTo = (world: DocumentWorld, id: string) =>
  `<p>See <a href="${documentAddress(world.ws, id)}">the plan</a>.</p>`;
const taskAddress = (world: DocumentWorld, task: Task) =>
  `https://tracker.example/dashboard/workspace/${world.ws}/project/${task.projectId}/task/${task.id}`;

const rows = async () =>
  (
    await db
      .select({
        taskId: taskDocumentTable.taskId,
        documentId: taskDocumentTable.documentId,
        source: taskDocumentTable.source,
        createdBy: taskDocumentTable.createdBy,
        grantsAccess: taskDocumentTable.grantsAccess,
      })
      .from(taskDocumentTable)
  ).sort((a, b) =>
    `${a.taskId}${a.documentId}${a.source}`.localeCompare(
      `${b.taskId}${b.documentId}${b.source}`,
    ),
  );
// What links a ticket to documents: "<document>:<where it was found>".
const linksOf = async (task: Task) =>
  (await rows())
    .filter((row) => row.taskId === task.id)
    .map((row) => `${row.documentId}:${row.source}`)
    .sort();
// What links a document to tickets, found in the document's own text.
const namedIn = async (documentId: string) =>
  (await rows())
    .filter((row) => row.documentId === documentId && row.source === "document")
    .map((row) => row.taskId)
    .sort();

const describeTask = async (
  world: DocumentWorld,
  user: Member,
  task: Task,
  description: string,
) => {
  const response = await world.as(user)(
    `/task/description/${task.id}`,
    json("PUT", { description }),
  );
  expect(response.status).toBe(200);
};
const comment = async (
  world: DocumentWorld,
  user: Member,
  task: Task,
  text: string,
) => {
  const response = await world.as(user)(
    "/activity/comment",
    json("POST", { taskId: task.id, comment: text }),
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: string }).id;
};
const write = async (
  world: DocumentWorld,
  user: Member,
  content: string,
  place: Record<string, string> = {},
) => {
  const response = await world.as(user)(
    "/document",
    json("POST", { workspaceId: world.ws, title: "Notes", content, ...place }),
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: string }).id;
};
const edit = async (
  world: DocumentWorld,
  user: Member,
  id: string,
  content: string,
) => {
  const response = await world.as(user)(
    `${base(world)}/${id}`,
    json("PATCH", { content }),
  );
  expect(response.status).toBe(200);
};
const linked = async (world: DocumentWorld, user: Member, taskId: string) => {
  const response = await world.as(user)(
    `${base(world)}?linkedTaskId=${taskId}`,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as Listed[];
};
const linkedIds = async (world: DocumentWorld, user: Member, task: Task) =>
  (await linked(world, user, task.id)).map((row) => row.id).sort();
const citedBy = async (world: DocumentWorld, user: Member, id: string) => {
  const response = await world.as(user)(`${base(world)}/${id}`);
  expect(response.status).toBe(200);
  return ((await response.json()) as { citedBy: Cited[] }).citedBy;
};

describe("API integration: links between tickets and documents", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("records a document linked in a ticket description or comment", async () => {
    const world = await buildDocumentWorld();
    const { owner, open, alphaTask, docs } = world;
    const plan = docs.teamAlpha;

    await describeTask(world, owner, alphaTask, linkTo(world, plan));
    expect(await rows()).toEqual([
      {
        taskId: alphaTask.id,
        documentId: plan,
        source: "description",
        createdBy: owner.id,
        grantsAccess: false,
      },
    ]);

    // Saving the same text again changes nothing, whoever saves it.
    await describeTask(
      world,
      open,
      alphaTask,
      `${linkTo(world, plan)}<p>.</p>`,
    );
    expect((await rows()).map((row) => row.createdBy)).toEqual([owner.id]);

    // Only comments are read: other activity on the ticket carries no link.
    await db.insert(activityTable).values({
      taskId: alphaTask.id,
      type: "status_changed",
      userId: owner.id,
      content: linkTo(world, docs.workspace),
    });
    const first = await comment(world, open, alphaTask, linkTo(world, plan));
    const second = await comment(world, owner, alphaTask, linkTo(world, plan));
    expect(await linksOf(alphaTask)).toEqual(
      [`${plan}:comment`, `${plan}:description`].sort(),
    );

    // The link leaves the description and stays in the comments.
    await describeTask(world, owner, alphaTask, "<p>Nothing here.</p>");
    expect(await linksOf(alphaTask)).toEqual([`${plan}:comment`]);

    // One of two comments goes: the other still carries the link.
    const removed = await world.as(open)(
      "/activity/comment",
      json("DELETE", { activityId: first }),
    );
    expect(removed.status).toBe(200);
    expect(await linksOf(alphaTask)).toEqual([`${plan}:comment`]);

    const edited = await world.as(owner)(
      "/activity/comment",
      json("PUT", { activityId: second, comment: "No link any more." }),
    );
    expect(edited.status).toBe(200);
    expect(await linksOf(alphaTask)).toEqual([]);

    const back = await world.as(owner)(
      "/activity/comment",
      json("PUT", {
        activityId: second,
        comment: `${linkTo(world, plan)} ${linkTo(world, docs.workspace)}`,
      }),
    );
    expect(back.status).toBe(200);
    expect(await linksOf(alphaTask)).toEqual(
      [`${plan}:comment`, `${docs.workspace}:comment`].sort(),
    );

    // The last comment with a link goes, and its links go with it.
    const last = await world.as(owner)(
      "/activity/comment",
      json("DELETE", { activityId: second }),
    );
    expect(last.status).toBe(200);
    expect(await linksOf(alphaTask)).toEqual([]);
  });

  it("records the link on a new ticket and on a copy of it", async () => {
    const world = await buildDocumentWorld();
    const { owner, docs } = world;

    const created = await world.as(owner)(
      `/task/${world.alpha.id}`,
      json("POST", {
        title: "Ship it",
        description: linkTo(world, docs.teamAlpha),
        priority: "low",
        status: "to-do",
      }),
    );
    expect(created.status).toBe(200);
    const task = (await created.json()) as Task;
    expect(await linksOf(task)).toEqual([`${docs.teamAlpha}:description`]);

    const copied = await world.as(owner)(
      `/task/duplicate/${task.id}`,
      json("POST", {}),
    );
    expect(copied.status).toBe(200);
    const copy = (await copied.json()) as Task;
    expect(copy.id).not.toBe(task.id);
    expect(await linksOf(copy)).toEqual([`${docs.teamAlpha}:description`]);

    const imported = await world.as(owner)(
      `/task/import/${world.alpha.id}`,
      json("POST", {
        tasks: [
          {
            title: "Imported",
            description: linkTo(world, docs.workspace),
            status: "to-do",
          },
        ],
      }),
    );
    expect(imported.status).toBe(200);
    expect(
      (await rows())
        .filter((row) => row.documentId === docs.workspace)
        .map((row) => row.source),
    ).toEqual(["description"]);
  });

  it.each(["github", "gitea", "gitlab"] as const)(
    "records a document linked in the text of an issue that %s opened",
    async (type) => {
      provider.write.mockResolvedValue({ id: 1 });
      const world = await buildDocumentWorld();
      const baseUrl =
        type === "github" ? "https://github.com" : `https://${type}.example`;
      const [integration] = await db
        .insert(schema.integrationTable)
        .values({
          projectId: world.alpha.id,
          type,
          isActive: true,
          config: JSON.stringify({
            baseUrl,
            repositoryOwner: "team",
            repositoryName: "repo",
            repositoryId: 1,
            installationId: 2,
            verifiedGithubAccountId: "3",
            verifiedByUserId: world.owner.id,
            accessToken: "test-only",
            projectPath: "team/repo",
            syncRules: {
              outgoing: { mode: "all" },
              incoming: { mode: "all" },
            },
          }),
        })
        .returning();
      if (!integration) throw new Error("no integration");
      const issue = {
        number: 7,
        title: "Follow the plan",
        body: `Steps are in ${documentAddress(world.ws, world.docs.teamAlpha)} and nowhere else.`,
        html_url: `${baseUrl}/team/repo/issues/7`,
        labels: [],
        user: { login: "author" },
      };
      const repository = { owner: { login: "team" }, name: "repo" };
      if (type === "github")
        await handleIssueOpened(
          {
            action: "opened",
            issue,
            installation: { id: 2 },
            repository: { ...repository, id: 1, full_name: "team/repo" },
          },
          integration.id,
        );
      else if (type === "gitea")
        await handleGiteaIssueOpened(
          {
            action: "opened",
            issue,
            repository: { ...repository, html_url: `${baseUrl}/team/repo` },
          },
          integration.id,
        );
      else
        await handleGitlabIssueOpened(
          {
            object_attributes: {
              iid: 7,
              title: issue.title,
              description: issue.body,
              url: issue.html_url,
            },
            labels: [],
            project: {
              name: "repo",
              path_with_namespace: "team/repo",
              web_url: `${baseUrl}/team/repo`,
            },
          },
          integration.id,
        );

      const [task] = await db
        .select({ id: schema.taskTable.id })
        .from(schema.taskTable)
        .where(eq(schema.taskTable.title, issue.title));
      if (!task) throw new Error(`${type} opened no issue`);
      expect((await rows()).filter((row) => row.taskId === task.id)).toEqual([
        {
          taskId: task.id,
          documentId: world.docs.teamAlpha,
          source: "description",
          createdBy: null,
          grantsAccess: false,
        },
      ]);
      if (type !== "github") return;

      // A comment the webhook brings in links a document too.
      await handleIssueCommentCreated({
        action: "created",
        issue: { number: 7 },
        comment: {
          id: 70,
          body: `Also ${documentAddress(world.ws, world.docs.workspace)}`,
          html_url: `${baseUrl}/team/repo/issues/7#issuecomment-70`,
          user: { login: "author", avatar_url: "" },
          created_at: new Date().toISOString(),
        },
        installation: { id: 2 },
        repository: { ...repository, id: 1 },
      });
      expect(
        (await rows()).filter(
          (row) => row.taskId === task.id && row.source === "comment",
        ),
      ).toMatchObject([{ documentId: world.docs.workspace, createdBy: null }]);
    },
  );

  it("records only the documents the issue's team can open from text an integration writes", async () => {
    provider.write.mockResolvedValue({ id: 1 });
    const world = await buildDocumentWorld();
    const { docs } = world;
    await db.insert(schema.integrationTable).values({
      projectId: world.alpha.id,
      type: "github",
      isActive: true,
      config: JSON.stringify({
        repositoryOwner: "team",
        repositoryName: "repo",
        repositoryId: 1,
        installationId: 2,
        verifiedGithubAccountId: "3",
        verifiedByUserId: world.owner.id,
        syncRules: { outgoing: { mode: "all" }, incoming: { mode: "all" } },
      }),
    });
    const repository = {
      id: 1,
      owner: { login: "team" },
      name: "repo",
      full_name: "team/repo",
    };
    const elsewhere = await buildDocumentWorld();
    const addresses = (...ids: [string, string][]) =>
      ids.map(([ws, id]) => documentAddress(ws, id)).join(" and ");
    const here = (id: string): [string, string] => [world.ws, id];

    await handleIssueOpened({
      action: "opened",
      issue: {
        number: 8,
        title: "Gather the notes",
        body: `See ${addresses(
          here(docs.teamAlpha),
          here(docs.issueAlpha),
          here(docs.workspace),
          here(docs.project),
          here(docs.projectAlpha),
          // Closed to team Alpha: another team, its issue and project, and
          // somebody's private notes.
          here(docs.teamBeta),
          here(docs.issueBeta),
          here(docs.projectBeta),
          here(docs.private),
          // Another workspace's document, at an address naming this one.
          here(elsewhere.docs.workspace),
          [elsewhere.ws, elsewhere.docs.workspace],
        )}.`,
        html_url: "https://github.com/team/repo/issues/8",
        labels: [],
        user: { login: "author" },
      },
      installation: { id: 2 },
      repository,
    });
    const [task] = await db
      .select({ id: schema.taskTable.id })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.title, "Gather the notes"));
    if (!task) throw new Error("no issue opened");
    const linked = async (source: string) =>
      (await rows())
        .filter((row) => row.taskId === task.id && row.source === source)
        .map((row) => row.documentId)
        .sort();
    expect(await linked("description")).toEqual(
      [
        docs.teamAlpha,
        docs.issueAlpha,
        docs.workspace,
        docs.project,
        docs.projectAlpha,
      ].sort(),
    );

    // A document shared with the issue is open to its team, so a comment the
    // webhook brings in links it; a private team's document still is not.
    const shared = await world.as(world.owner)(
      `${base(world)}/${docs.teamBeta}/task/${task.id}/share`,
      json("PUT"),
    );
    expect(shared.status).toBe(200);
    // A member's own comment links a document of another team; the webhook
    // must not drop that link.
    await comment(
      world,
      world.owner,
      { ...world.alphaTask, id: task.id },
      linkTo(world, docs.projectBeta),
    );
    await handleIssueCommentCreated({
      action: "created",
      issue: { number: 8 },
      comment: {
        id: 80,
        body: `Also ${addresses(here(docs.teamBeta), here(docs.issueBeta))}`,
        html_url: "https://github.com/team/repo/issues/8#issuecomment-80",
        user: { login: "author", avatar_url: "" },
        created_at: new Date().toISOString(),
      },
      installation: { id: 2 },
      repository,
    });
    expect(await linked("comment")).toEqual(
      [docs.teamBeta, docs.projectBeta].sort(),
    );
  });

  it("records a ticket named in a document, by address or by its key", async () => {
    const world = await buildDocumentWorld();
    const { owner, open, alphaTask, betaTask } = world;

    const notes = await write(
      world,
      owner,
      `<p>Tracked in <a href="${taskAddress(world, alphaTask)}">the issue</a>.</p>`,
      { projectId: world.alpha.id },
    );
    expect(await rows()).toEqual([
      {
        taskId: alphaTask.id,
        documentId: notes,
        source: "document",
        createdBy: owner.id,
        grantsAccess: false,
      },
    ]);

    // A ticket key typed into the text is a link; a longer word that ends in
    // one, and a key of no ticket, are not.
    await edit(
      world,
      open,
      notes,
      "<p>Moved to BETA-1. Not pre-alpha-1, not ALPHA-12, not GAMMA-1.</p>",
    );
    expect(await namedIn(notes)).toEqual([betaTask.id]);

    // The address a person copies from the ticket page carries the key.
    await edit(
      world,
      owner,
      notes,
      "<p>https://tracker.example/acme/task/alpha-1/ship-it and BETA-1</p>",
    );
    expect(await namedIn(notes)).toEqual([alphaTask.id, betaTask.id].sort());

    // An older text comes back, and the links follow the text.
    const versions = (await (
      await world.as(owner)(`${base(world)}/${notes}/versions`)
    ).json()) as { id: string }[];
    const restored = await world.as(owner)(
      `${base(world)}/${notes}/versions/${versions.at(-1)?.id}/restore`,
      json("POST"),
    );
    expect(restored.status).toBe(200);
    expect(await namedIn(notes)).toEqual([alphaTask.id]);

    // Text an assistant saves is read the same way.
    const saved = await world.as(owner)(
      "/document/file",
      json("POST", {
        workspaceId: world.ws,
        title: "From a chat",
        markdown: `Follow up in [the issue](${taskAddress(world, betaTask)}).`,
        idempotencyKey: "one",
      }),
    );
    expect(saved.status).toBe(200);
    const draft = ((await saved.json()) as { id: string }).id;
    expect(await namedIn(draft)).toEqual([betaTask.id]);

    // A key two teams answer to names neither of their tickets.
    const twin = await createProjectFixture({
      workspaceId: world.ws,
      name: "Alpha twin",
      slug: "ALPHA",
    });
    await createTaskFixture(twin, "Twin issue", owner.id);
    await edit(world, owner, notes, "<p>ALPHA-1 and BETA-1</p>");
    expect(await namedIn(notes)).toEqual([betaTask.id]);
  });

  it("records nothing for another workspace or an unknown id", async () => {
    const world = await buildDocumentWorld();
    const { owner, alphaTask } = world;
    const elsewhere = await createWorkspaceMember({ role: "owner" });
    const gamma = await createProjectFixture({
      workspaceId: elsewhere.workspace.id,
      name: "Gamma",
      slug: "gamma",
    });
    const gammaTask = await createTaskFixture(
      gamma,
      "Gamma issue",
      elsewhere.user.id,
    );
    const foreign = await world.as(elsewhere.user)(
      "/document",
      json("POST", {
        workspaceId: elsewhere.workspace.id,
        title: "Elsewhere",
        // The key of a ticket in the first workspace means nothing here.
        content: "<p>ALPHA-1</p>",
      }),
    );
    expect(foreign.status).toBe(200);
    const foreignId = ((await foreign.json()) as { id: string }).id;

    await describeTask(
      world,
      owner,
      alphaTask,
      [
        documentAddress(elsewhere.workspace.id, foreignId),
        documentAddress(world.ws, foreignId),
        documentAddress(world.ws, "nope"),
      ].join(" "),
    );
    await write(
      world,
      owner,
      `<p>${gammaTask.id} /task/${gammaTask.id} GAMMA-1 /task/nope</p>`,
    );

    expect(await rows()).toEqual([]);
  });

  it("lists a ticket's documents only to people who can open both", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open, alphaTask, betaTask, docs } = world;
    await describeTask(
      world,
      owner,
      alphaTask,
      [docs.teamAlpha, docs.teamBeta, docs.private]
        .map((id) => linkTo(world, id))
        .join(""),
    );
    await comment(world, owner, alphaTask, linkTo(world, docs.teamAlpha));
    await describeTask(world, owner, betaTask, linkTo(world, docs.teamAlpha));

    const seen = await linked(world, owner, alphaTask.id);
    expect(seen.map((row) => row.id).sort()).toEqual(
      [docs.teamAlpha, docs.teamBeta, docs.private].sort(),
    );
    expect(seen.find((row) => row.id === docs.teamAlpha)).toMatchObject({
      title: "leakdoc teamAlpha",
      status: "draft",
      currentDocumentId: null,
    });
    expect(await linkedIds(world, open, alphaTask)).toEqual(
      [docs.teamAlpha, docs.teamBeta].sort(),
    );
    expect(await linkedIds(world, limited, alphaTask)).toEqual([
      docs.teamAlpha,
    ]);

    // A ticket the person cannot open answers like one that does not exist,
    // although they can open the document it links.
    expect(await linkedIds(world, owner, betaTask)).toEqual([docs.teamAlpha]);
    expect(await linked(world, limited, betaTask.id)).toEqual([]);
    expect(await linked(world, limited, "nope")).toEqual([]);

    // A ticket of another workspace is unknown here.
    const elsewhere = await createWorkspaceMember({ role: "owner" });
    const gamma = await createProjectFixture({
      workspaceId: elsewhere.workspace.id,
      name: "Gamma",
      slug: "gamma",
    });
    const gammaTask = await createTaskFixture(
      gamma,
      "Gamma issue",
      elsewhere.user.id,
    );
    await db.insert(taskDocumentTable).values({
      taskId: gammaTask.id,
      documentId: docs.teamAlpha,
      source: "description",
    });
    expect(await linked(world, owner, gammaTask.id)).toEqual([]);
    expect(await citedBy(world, owner, docs.teamAlpha)).toHaveLength(2);
  });

  it("names the tickets that cite a document, only those the viewer can open", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, alphaTask, betaTask, docs } = world;
    // Shared with `limited` by name.
    const plan = docs.sharedByName;
    expect(await citedBy(world, owner, plan)).toEqual([]);

    await describeTask(world, owner, alphaTask, linkTo(world, plan));
    await comment(world, owner, alphaTask, linkTo(world, plan));
    await describeTask(world, owner, betaTask, linkTo(world, plan));

    // Links to one document say nothing about another.
    expect(await citedBy(world, owner, docs.workspace)).toEqual([]);
    expect(await citedBy(world, limited, plan)).toEqual([
      {
        id: alphaTask.id,
        title: "Alpha issue",
        number: 1,
        projectId: world.alpha.id,
        projectSlug: "alpha",
      },
    ]);
    expect(
      (await citedBy(world, owner, plan)).map((task) => task.id).sort(),
    ).toEqual([alphaTask.id, betaTask.id].sort());

    // A ticket the document names counts the same as one that names it.
    await edit(world, owner, docs.teamAlpha, "<p>See BETA-1 and ALPHA-1.</p>");
    expect(
      (await citedBy(world, limited, docs.teamAlpha)).map((task) => task.id),
    ).toEqual([alphaTask.id]);
    expect(await linkedIds(world, owner, betaTask)).toEqual(
      [plan, docs.teamAlpha].sort(),
    );
  });

  it("points from a replaced document to the current one", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open, alphaTask } = world;
    // Team Beta: `limited` cannot open the topic.
    const created = await world.as(owner)(
      "/topic",
      json("POST", {
        workspaceId: world.ws,
        name: "Pricing",
        projectId: world.beta.id,
      }),
    );
    expect(created.status).toBe(200);
    const topic = ((await created.json()) as { id: string }).id;
    const decide = async (documentId: string) => {
      const at = `/topic/workspace/${world.ws}/${topic}/document/${documentId}`;
      expect((await world.as(owner)(at, json("PUT"))).status).toBe(200);
      const response = await world.as(owner)(
        `${at}/current`,
        json("POST", { reason: REASON }),
      );
      expect(response.status).toBe(200);
    };
    const old = await write(world, owner, "<p>Old prices</p>");
    const next = await write(world, owner, "<p>New prices</p>");
    await decide(old);
    await decide(next);
    const shared = await world.as(owner)(
      `${base(world)}/${old}/share/${limited.id}`,
      json("PUT", { access: "view" }),
    );
    expect(shared.status).toBe(200);
    await describeTask(
      world,
      owner,
      alphaTask,
      linkTo(world, old) + linkTo(world, next),
    );

    const current = (rowsSeen: Listed[]) =>
      rowsSeen.map(({ id, status, currentDocumentId }) => ({
        id,
        status,
        currentDocumentId,
      }));
    const both = [
      { id: old, status: "superseded", currentDocumentId: next },
      { id: next, status: "current", currentDocumentId: null },
    ].sort((a, b) => a.id.localeCompare(b.id));
    const sorted = async (user: Member) =>
      current(await linked(world, user, alphaTask.id)).sort((a, b) =>
        a.id.localeCompare(b.id),
      );
    expect(await sorted(owner)).toEqual(both);
    expect(await sorted(open)).toEqual(both);
    // The old one is shared by name; the topic and its current document are not.
    expect(await sorted(limited)).toEqual([
      { id: old, status: "superseded", currentDocumentId: null },
    ]);

    // The routes refuse to make the states marked "forced". The rule holds
    // without that help. Forced: a topic in a place its current document is
    // not in, so `limited` can open the topic and not the document.
    const moveTopic = (projectId: string) =>
      db.update(topicTable).set({ projectId }).where(eq(topicTable.id, topic));
    await moveTopic(world.alpha.id);
    expect(await sorted(limited)).toEqual([
      { id: old, status: "superseded", currentDocumentId: null },
    ]);
    await moveTopic(world.beta.id);

    // Shared by name as well, the current one is listed but not pointed at:
    // that would say what a topic they cannot open has decided.
    const sharedNext = await world.as(owner)(
      `${base(world)}/${next}/share/${limited.id}`,
      json("PUT", { access: "view" }),
    );
    expect(sharedNext.status).toBe(200);
    expect(await sorted(limited)).toEqual(
      [
        { id: old, status: "superseded", currentDocumentId: null },
        { id: next, status: "current", currentDocumentId: null },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );

    const force = (values: Partial<typeof documentTable.$inferInsert>) =>
      db.update(documentTable).set(values).where(eq(documentTable.id, next));
    // Forced: a topic with no current document.
    await force({ status: "draft" });
    expect((await sorted(owner)).map((row) => row.currentDocumentId)).toEqual([
      null,
      null,
    ]);
    // Forced: a current document in the bin.
    await force({ status: "current", deletedAt: new Date() });
    expect(await sorted(owner)).toEqual([
      { id: old, status: "superseded", currentDocumentId: null },
    ]);
  });

  it("opens nothing: a link does not let anybody into a document", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, alphaTask, docs } = world;

    // `limited` knows the id of a document they cannot open.
    await describeTask(world, limited, alphaTask, linkTo(world, docs.private));
    expect(await rows()).toEqual([
      {
        taskId: alphaTask.id,
        documentId: docs.private,
        source: "description",
        createdBy: limited.id,
        grantsAccess: false,
      },
    ]);

    const hidden = await world.as(limited)(`${base(world)}/${docs.private}`);
    const unknown = await world.as(limited)(`${base(world)}/nope`);
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toEqual(await unknown.json());
    expect(await linked(world, limited, alphaTask.id)).toEqual([]);
    expect(await linkedIds(world, owner, alphaTask)).toEqual([docs.private]);
  });
});
