import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { referenceTable } from "../../apps/api/src/database/schema";
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

type Member = DocumentWorld["owner"];
type Task = DocumentWorld["alphaTask"];
type Reference = {
  kind: "task" | "document";
  id: string;
  title: string;
  key: string | null;
  places: string[];
};

const taskAddress = (workspaceId: string, task: Task) =>
  `https://tracker.example/dashboard/workspace/${workspaceId}/project/${task.projectId}/task/${task.id}`;
const prettyTaskAddress = (key: string) =>
  `https://tracker.example/acme/task/${key}/the-title`;
const documentAddress = (workspaceId: string, id: string) =>
  `https://tracker.example/dashboard/workspace/${workspaceId}/document/${id}`;
const projectAddress = (workspaceId: string, projectId: string) =>
  `https://tracker.example/dashboard/workspace/${workspaceId}/project/${projectId}/board`;
// What the editor stores for a pasted ticket link.
const issueChip = (url: string) =>
  `<p>See <span data-type="kaneo-issue-link" data-url="${url}"></span></p>`;

// A second ticket in a team, numbered after the fixture's first one.
async function addTask(team: { id: string }, title: string, userId: string) {
  const [column] = await db
    .select()
    .from(schema.columnTable)
    .where(eq(schema.columnTable.projectId, team.id))
    .limit(1);
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: team.id,
      title,
      status: column?.slug ?? "to-do",
      columnId: column?.id,
      userId,
      number: 2,
    })
    .returning();
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 2 })
    .where(eq(schema.projectTable.id, team.id));
  if (!task) throw new Error("Could not create the task");
  return task;
}

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
const editComment = async (
  world: DocumentWorld,
  user: Member,
  activityId: string,
  text: string,
) => {
  const response = await world.as(user)(
    "/activity/comment",
    json("PUT", { activityId, comment: text }),
  );
  expect(response.status).toBe(200);
};
const writeDocument = async (
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
const editDocument = async (
  world: DocumentWorld,
  user: Member,
  id: string,
  content: string,
) => {
  const response = await world.as(user)(
    `/document/workspace/${world.ws}/${id}`,
    json("PATCH", { content }),
  );
  expect(response.status).toBe(200);
};
const read = async (world: DocumentWorld, user: Member, path: string) => {
  const response = await world.as(user)(`/reference${path}`);
  expect(response.status).toBe(200);
  const body = await response.text();
  return {
    body,
    references: (JSON.parse(body) as { references: Reference[] }).references,
  };
};
const ofTask = async (world: DocumentWorld, user: Member, task: Task) =>
  (await read(world, user, `/task/${task.id}`)).references;
const status = async (world: DocumentWorld, user: Member, path: string) =>
  (await world.as(user)(`/reference${path}`)).status;

describe("API integration: references between tickets, documents and teams", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lists a ticket that names another once, and drops each place as its link goes", async () => {
    const world = await buildDocumentWorld();
    const { owner, alpha, alphaTask: a } = world;
    const b = await addTask(alpha, "Second alpha issue", owner.id);

    const remark = await comment(
      world,
      owner,
      a,
      issueChip(taskAddress(world.ws, b)),
    );
    await describeTask(world, owner, a, "<p>Blocked on ALPHA-2 today.</p>");

    expect(await ofTask(world, owner, b)).toEqual([
      {
        kind: "task",
        id: a.id,
        title: "Alpha issue",
        key: "ALPHA-1",
        places: ["comment", "description"],
      },
    ]);
    // Nothing points at A, and A naming itself is no reference.
    await describeTask(world, owner, a, "<p>ALPHA-1 and ALPHA-2.</p>");
    expect(await ofTask(world, owner, a)).toEqual([]);

    await editComment(world, owner, remark, "<p>Never mind.</p>");
    expect((await ofTask(world, owner, b)).map((ref) => ref.places)).toEqual([
      ["description"],
    ]);

    await describeTask(world, owner, a, "<p>Nothing to see.</p>");
    expect(await ofTask(world, owner, b)).toEqual([]);
  });

  it("records what a new ticket's description names", async () => {
    const world = await buildDocumentWorld();
    const { owner, alpha, alphaTask, docs } = world;
    const [column] = await db
      .select({ slug: schema.columnTable.slug })
      .from(schema.columnTable)
      .where(eq(schema.columnTable.projectId, alpha.id))
      .limit(1);

    const response = await world.as(owner)(
      `/task/${alpha.id}`,
      json("POST", {
        title: "Follow-up",
        description: `<p>After ALPHA-1, see ${documentAddress(world.ws, docs.workspace)} and ${projectAddress(world.ws, alpha.id)}</p>`,
        status: column?.slug,
        priority: "no-priority",
      }),
    );
    expect(response.status).toBe(200);
    const created = (await response.json()) as { id: string };

    const sources = async (path: string) =>
      (await read(world, owner, path)).references.map((ref) => ref.id);
    expect(await ofTask(world, owner, alphaTask)).toEqual([
      {
        kind: "task",
        id: created.id,
        title: "Follow-up",
        key: "ALPHA-2",
        places: ["description"],
      },
    ]);
    expect(
      await sources(`/workspace/${world.ws}/document/${docs.workspace}`),
    ).toEqual([created.id]);
    expect(await sources(`/project/${alpha.id}`)).toEqual([created.id]);
  });

  it("reads a pretty ticket address and drops a deleted comment's link", async () => {
    const world = await buildDocumentWorld();
    const { owner, alpha, alphaTask: a } = world;
    const b = await addTask(alpha, "Second alpha issue", owner.id);

    const remark = await comment(
      world,
      owner,
      a,
      `<p><a href="${prettyTaskAddress("ALPHA-2")}">link</a></p>`,
    );
    expect((await ofTask(world, owner, b)).map((ref) => ref.id)).toEqual([
      a.id,
    ]);

    const removed = await world.as(owner)(
      "/activity/comment",
      json("DELETE", { activityId: remark }),
    );
    expect(removed.status).toBe(200);
    expect(await ofTask(world, owner, b)).toEqual([]);
  });

  it("lists a document that names a ticket until the document stops", async () => {
    const world = await buildDocumentWorld();
    const { owner, alphaTask } = world;

    const notes = await writeDocument(
      world,
      owner,
      `<p>${taskAddress(world.ws, alphaTask)} and ALPHA-1</p>`,
    );
    expect(await ofTask(world, owner, alphaTask)).toEqual([
      {
        kind: "document",
        id: notes,
        title: "Notes",
        key: null,
        places: ["document"],
      },
    ]);

    await editDocument(world, owner, notes, "<p>Gone.</p>");
    expect(await ofTask(world, owner, alphaTask)).toEqual([]);
  });

  it("leaves out every source the reader cannot open", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open, alpha, alphaTask, betaTask, docs } = world;
    // A ticket and a team document in Beta, which `limited` cannot enter,
    // name a ticket, a document and a team that `limited` can open.
    const names = [
      taskAddress(world.ws, alphaTask),
      documentAddress(world.ws, docs.workspace),
      projectAddress(world.ws, alpha.id),
    ].join(" ");
    await describeTask(world, owner, betaTask, `<p>Secret plan: ${names}</p>`);
    await editDocument(world, owner, docs.teamBeta, `<p>${names}</p>`);

    const paths = [
      `/task/${alphaTask.id}`,
      `/workspace/${world.ws}/document/${docs.workspace}`,
      `/project/${alpha.id}`,
    ];
    for (const path of paths) {
      const seen = await read(world, limited, path);
      expect(seen.references).toEqual([]);
      expect(seen.body).not.toContain(betaTask.id);
      expect(seen.body).not.toContain(docs.teamBeta);
    }

    // Someone who can open both sources sees them on every route.
    for (const path of paths) {
      expect(
        (await read(world, open, path)).references
          .map((ref) => ref.title)
          .sort(),
      ).toEqual(["Beta issue", "leakdoc teamBeta"]);
    }
  });

  it("refuses a reader who cannot open the ticket, and anyone outside the workspace", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, alphaTask, betaTask } = world;
    await describeTask(world, owner, alphaTask, "<p>BETA-1</p>");
    const outsider = await createWorkspaceMember({ role: "owner" });

    expect(await status(world, limited, `/task/${betaTask.id}`)).toBe(403);
    expect(
      [403, 404].includes(
        await status(world, outsider.user, `/task/${betaTask.id}`),
      ),
    ).toBe(true);
    expect(await status(world, owner, "/task/nope")).toBe(404);
  });

  it("records nothing that points into another workspace", async () => {
    const world = await buildDocumentWorld();
    const { alphaTask, docs } = world;
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
    await describeTask(
      world,
      elsewhere.user,
      gammaTask,
      [
        taskAddress(world.ws, alphaTask),
        "ALPHA-1",
        documentAddress(world.ws, docs.workspace),
        projectAddress(world.ws, world.alpha.id),
      ].join(" "),
    );

    expect(await db.select().from(referenceTable)).toEqual([]);
  });

  it("lists the tickets that link a document, to people who can see it", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, alphaTask, docs } = world;
    await describeTask(
      world,
      owner,
      alphaTask,
      `<p>${documentAddress(world.ws, docs.workspace)} ${documentAddress(world.ws, docs.teamBeta)}</p>`,
    );

    const path = (id: string) => `/workspace/${world.ws}/document/${id}`;
    expect(
      (await read(world, limited, path(docs.workspace))).references,
    ).toEqual([
      {
        kind: "task",
        id: alphaTask.id,
        title: "Alpha issue",
        key: "ALPHA-1",
        places: ["description"],
      },
    ]);
    expect(await status(world, limited, path(docs.teamBeta))).toBe(404);
    expect(
      (await read(world, owner, path(docs.teamBeta))).references.map(
        (ref) => ref.id,
      ),
    ).toEqual([alphaTask.id]);
  });

  it("lists the tickets that link a team, to people who can open it", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, alpha, beta, alphaTask } = world;
    await describeTask(
      world,
      owner,
      alphaTask,
      `<p>${projectAddress(world.ws, alpha.id)} ${projectAddress(world.ws, beta.id)}</p>`,
    );

    expect(
      (await read(world, limited, `/project/${alpha.id}`)).references.map(
        (ref) => ref.id,
      ),
    ).toEqual([alphaTask.id]);
    expect(await status(world, limited, `/project/${beta.id}`)).toBe(404);
    expect(
      (await read(world, owner, `/project/${beta.id}`)).references.map(
        (ref) => ref.id,
      ),
    ).toEqual([alphaTask.id]);
    // A ticket address is a reference to the ticket, not to its team.
    await describeTask(
      world,
      owner,
      alphaTask,
      issueChip(taskAddress(world.ws, alphaTask)),
    );
    expect(await read(world, owner, `/project/${alpha.id}`)).toMatchObject({
      references: [],
    });
  });
});
