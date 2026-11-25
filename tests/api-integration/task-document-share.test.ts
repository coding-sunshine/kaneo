import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db from "../../apps/api/src/database";
import { taskDocumentTable } from "../../apps/api/src/database/schema";
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
type Opened = {
  id: string;
  role: string;
  sharedTasks: {
    id: string;
    title: string | null;
    number: number | null;
    projectId: string | null;
    projectSlug: string | null;
  }[];
};

const base = (world: DocumentWorld) => `/document/workspace/${world.ws}`;
const linkTo = (world: DocumentWorld, id: string) =>
  `<p>See <a href="https://tracker.example/dashboard/workspace/${world.ws}/document/${id}">the plan</a>.</p>`;
const at = (world: DocumentWorld, id: string, taskId: string) =>
  `${base(world)}/${id}/task/${taskId}`;

const share = (
  world: DocumentWorld,
  user: Member,
  id: string,
  taskId: string,
) => world.as(user)(`${at(world, id, taskId)}/share`, json("PUT"));
const unshare = (
  world: DocumentWorld,
  user: Member,
  id: string,
  taskId: string,
) => world.as(user)(`${at(world, id, taskId)}/share`, json("DELETE"));
const audience = (
  world: DocumentWorld,
  user: Member,
  id: string,
  taskId: string,
) => world.as(user)(`${at(world, id, taskId)}/audience`);
const open = (world: DocumentWorld, user: Member, id: string) =>
  world.as(user)(`${base(world)}/${id}`);
const sharedTasksOf = async (world: DocumentWorld, user: Member, id: string) =>
  ((await (await open(world, user, id)).json()) as Opened).sharedTasks;
const listedIds = async (world: DocumentWorld, user: Member) =>
  ((await (await world.as(user)(base(world))).json()) as { id: string }[]).map(
    (row) => row.id,
  );

const grants = async (documentId?: string) =>
  (
    await db
      .select({
        taskId: taskDocumentTable.taskId,
        documentId: taskDocumentTable.documentId,
      })
      .from(taskDocumentTable)
      .where(
        documentId
          ? and(
              eq(taskDocumentTable.source, "share"),
              eq(taskDocumentTable.documentId, documentId),
            )
          : eq(taskDocumentTable.source, "share"),
      )
  ).sort((a, b) => a.taskId.localeCompare(b.taskId));

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

// Who can open each issue: `limited` may only enter team Alpha.
const peopleOf = (world: DocumentWorld, task: Task) =>
  task.id === world.alphaTask.id
    ? [world.owner, world.limited, world.open]
    : [world.owner, world.open];
// What the contract says `audience` reports for a document and an issue.
const expectedAudience = async (
  world: DocumentWorld,
  task: Task,
  id: string,
) => {
  const people = peopleOf(world, task);
  const gains: string[] = [];
  for (const person of people) {
    if ((await open(world, person, id)).status !== 200) gains.push(person.id);
  }
  return { total: people.length, missing: gains.length, gains: gains.sort() };
};
// The answer, with the people who would gain access as their ids.
const reported = async (response: Response) => {
  const body = (await response.json()) as {
    total: number;
    missing: number;
    gains: { userId: string }[];
  };
  return { ...body, gains: body.gains.map((person) => person.userId).sort() };
};

describe("API integration: sharing a document with the people of an issue", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("gives nobody access to a document just because a link names it", async () => {
    const world = await buildDocumentWorld();
    const { owner, open: member, limited, alphaTask, docs } = world;

    await describeTask(world, owner, alphaTask, linkTo(world, docs.private));

    expect((await open(world, member, docs.private)).status).toBe(404);
    expect((await open(world, limited, docs.private)).status).toBe(404);
    expect(await grants()).toEqual([]);

    const response = await audience(world, owner, docs.private, alphaTask.id);
    expect(response.status).toBe(200);
    const counted = await expectedAudience(world, alphaTask, docs.private);
    expect(counted).toEqual({
      total: 3,
      missing: 2,
      gains: [member.id, limited.id].sort(),
    });
    // Each person who would gain access comes with a name and a picture only.
    const body = (await response.clone().json()) as {
      gains: Record<string, unknown>[];
    };
    for (const person of body.gains) {
      expect(Object.keys(person).sort()).toEqual(["image", "name", "userId"]);
      expect(person.name).toEqual(expect.any(String));
    }
    expect(await reported(response)).toEqual(counted);
  });

  it("lets everyone who can open the issue view the document once it is shared", async () => {
    const world = await buildDocumentWorld();
    const { owner, open: member, limited, alphaTask, docs } = world;

    const shared = await share(world, owner, docs.private, alphaTask.id);
    expect(shared.status).toBe(200);
    const body = (await shared.json()) as Opened;
    expect(body.id).toBe(docs.private);
    expect(body.sharedTasks.map((task) => task.id)).toEqual([alphaTask.id]);
    expect(await grants(docs.private)).toEqual([
      { taskId: alphaTask.id, documentId: docs.private },
    ]);

    for (const person of [member, limited]) {
      const response = await open(world, person, docs.private);
      expect(response.status).toBe(200);
      expect(((await response.json()) as Opened).role).toBe("view");
      expect(await listedIds(world, person)).toContain(docs.private);
    }

    const edited = await world.as(member)(
      `${base(world)}/${docs.private}`,
      json("PATCH", { title: "taken" }),
    );
    expect(edited.status).toBe(403);

    const response = await audience(world, owner, docs.private, alphaTask.id);
    expect(await reported(response)).toEqual({
      total: 3,
      missing: 0,
      gains: [],
    });
  });

  it("keeps people who cannot open the issue out of the shared document", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, betaTask, docs } = world;

    // `limited` cannot enter team Beta, so the issue is closed to them.
    const shared = await share(world, owner, docs.private, betaTask.id);
    expect(shared.status).toBe(200);

    expect((await open(world, limited, docs.private)).status).toBe(404);
    expect((await open(world, world.open, docs.private)).status).toBe(200);
    expect(await listedIds(world, limited)).not.toContain(docs.private);

    const response = await audience(world, owner, docs.private, betaTask.id);
    expect(await reported(response)).toEqual({
      total: 2,
      missing: 0,
      gains: [],
    });
  });

  it("keeps the grant when the description is saved without the link", async () => {
    const world = await buildDocumentWorld();
    const { owner, open: member, alphaTask, docs } = world;

    await describeTask(world, owner, alphaTask, linkTo(world, docs.private));
    expect((await share(world, owner, docs.private, alphaTask.id)).status).toBe(
      200,
    );

    await describeTask(world, owner, alphaTask, "<p>Nothing here.</p>");

    expect((await open(world, member, docs.private)).status).toBe(200);
    expect(await grants(docs.private)).toHaveLength(1);
  });

  it("takes the access away again when the share is removed", async () => {
    const world = await buildDocumentWorld();
    const { owner, open: member, alphaTask, docs } = world;
    await share(world, owner, docs.private, alphaTask.id);
    expect((await open(world, member, docs.private)).status).toBe(200);

    const removed = await unshare(world, owner, docs.private, alphaTask.id);
    expect(removed.status).toBe(200);
    expect(((await removed.json()) as Opened).sharedTasks).toEqual([]);
    expect((await open(world, member, docs.private)).status).toBe(404);
    expect(await grants()).toEqual([]);
  });

  it("answers 200 when the share to remove does not exist", async () => {
    const world = await buildDocumentWorld();
    const { owner, alphaTask, docs } = world;

    const removed = await unshare(world, owner, docs.private, alphaTask.id);
    expect(removed.status).toBe(200);
    expect(((await removed.json()) as Opened).id).toBe(docs.private);
  });

  it("lets a person remove a share for an issue they cannot open", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, alphaTask, betaTask, docs } = world;
    await share(world, owner, docs.teamAlpha, betaTask.id);
    await share(world, owner, docs.teamAlpha, alphaTask.id);

    const removed = await unshare(world, limited, docs.teamAlpha, betaTask.id);
    expect(removed.status).toBe(200);
    expect(await grants(docs.teamAlpha)).toEqual([
      { taskId: alphaTask.id, documentId: docs.teamAlpha },
    ]);
  });

  it("asks for edit rights on the document to share it or remove the share", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, alphaTask, betaTask, docs } = world;
    await share(world, owner, docs.sharedByName, alphaTask.id);
    // Team Beta is closed to `limited`, so this share lets them into nothing.
    await share(world, owner, docs.private, betaTask.id);
    const before = await grants();

    // `limited` may only view `sharedByName` and cannot open `private`.
    for (const [id, status] of [
      [docs.sharedByName, 403],
      [docs.private, 404],
      ["no-such-document", 404],
    ] as const) {
      for (const call of [share, unshare]) {
        const response = await call(world, limited, id, alphaTask.id);
        expect({ id, call: call.name, status: response.status }).toEqual({
          id,
          call: call.name,
          status,
        });
      }
      if (status === 404) {
        const response = await audience(world, limited, id, alphaTask.id);
        expect({ id, audience: response.status }).toEqual({
          id,
          audience: 404,
        });
      }
    }
    expect(await grants()).toEqual(before);
  });

  it("answers a hidden document like an unknown one on every new route", async () => {
    const world = await buildDocumentWorld();
    const { limited, alphaTask, docs } = world;
    const answer = async (id: string, method: string) => {
      const route = method === "GET" ? "audience" : "share";
      const response = await world.as(limited)(
        `${at(world, id, alphaTask.id)}/${route}`,
        method === "GET" ? undefined : json(method),
      );
      return { status: response.status, body: await response.json() };
    };
    for (const method of ["GET", "PUT", "DELETE"]) {
      const unknown = await answer("no-such-document", method);
      expect(unknown.status).toBe(404);
      expect(await answer(docs.private, method)).toEqual(unknown);
      expect(await answer(docs.teamBeta, method)).toEqual(unknown);
    }
  });

  it("refuses an issue that is unknown, elsewhere or in a team the sharer cannot enter", async () => {
    const world = await buildDocumentWorld();
    const { limited, betaTask, docs } = world;
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

    // `limited` may edit this document and cannot enter team Beta.
    const id = docs.teamAlpha;
    for (const call of ["share", "audience"] as const) {
      const answer = async (taskId: string) => {
        const response =
          call === "share"
            ? await share(world, limited, id, taskId)
            : await audience(world, limited, id, taskId);
        return { status: response.status, body: await response.json() };
      };
      const unknown = await answer("no-such-issue");
      expect(unknown.status).toBe(404);
      expect(await answer(gammaTask.id)).toEqual(unknown);
      expect(await answer(betaTask.id)).toEqual(unknown);
    }
    expect(await grants()).toEqual([]);
  });

  it("shows the issues holding a share according to what the viewer can open", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, alphaTask, betaTask, docs } = world;
    const alphaEntry = {
      id: alphaTask.id,
      title: "Alpha issue",
      number: 1,
      projectId: world.alpha.id,
      projectSlug: "alpha",
    };
    const betaEntry = {
      id: betaTask.id,
      title: "Beta issue",
      number: 1,
      projectId: world.beta.id,
      projectSlug: "beta",
    };
    const hiddenBeta = {
      id: betaTask.id,
      title: null,
      number: null,
      projectId: null,
      projectSlug: null,
    };
    const byId = (rows: Opened["sharedTasks"]) =>
      [...rows].sort((a, b) => a.id.localeCompare(b.id));

    expect(await sharedTasksOf(world, owner, docs.teamAlpha)).toEqual([]);
    await share(world, owner, docs.teamAlpha, alphaTask.id);
    await share(world, owner, docs.teamAlpha, betaTask.id);
    await share(world, owner, docs.sharedByName, alphaTask.id);
    await share(world, owner, docs.sharedByName, betaTask.id);

    // An editor sees every grant; an issue they cannot open is only an id.
    expect(byId(await sharedTasksOf(world, owner, docs.teamAlpha))).toEqual(
      byId([alphaEntry, betaEntry]),
    );
    expect(byId(await sharedTasksOf(world, limited, docs.teamAlpha))).toEqual(
      byId([alphaEntry, hiddenBeta]),
    );
    // Someone who may only view sees the issues they can open.
    expect(await sharedTasksOf(world, limited, docs.sharedByName)).toEqual([
      alphaEntry,
    ]);
  });

  it("lets the people of an issue keep a document filed on a topic elsewhere", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, alphaTask, docs } = world;
    const id = docs.issueAlpha;
    expect((await open(world, limited, id)).status).toBe(200);

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
    const filed = await world.as(owner)(
      `/topic/workspace/${world.ws}/${topic}/document/${id}`,
      json("PUT"),
    );
    expect(filed.status).toBe(200);

    // The topic is in team Beta, which `limited` cannot enter.
    const response = await open(world, limited, id);
    expect(response.status).toBe(200);
    expect(((await response.json()) as Opened).role).toBe("view");
    expect(
      (await sharedTasksOf(world, owner, id)).map((task) => task.id),
    ).toEqual([alphaTask.id]);
  });

  it("removes the share when the document is made private", async () => {
    const world = await buildDocumentWorld();
    const { owner, open: member, alphaTask, docs } = world;
    await share(world, owner, docs.private, alphaTask.id);
    expect((await open(world, member, docs.private)).status).toBe(200);

    const moved = await world.as(owner)(
      `${base(world)}/${docs.private}/location`,
      json("PUT", { scope: "private" }),
    );
    expect(moved.status).toBe(200);

    expect((await open(world, member, docs.private)).status).toBe(404);
    expect(await grants(docs.private)).toEqual([]);
  });

  it("removes the share when the issue is deleted", async () => {
    const world = await buildDocumentWorld();
    const { owner, open: member, limited, alphaTask, docs } = world;
    await share(world, owner, docs.private, alphaTask.id);
    expect(await grants(docs.private)).toHaveLength(1);

    const deleted = await world.as(owner)(
      `/task/${alphaTask.id}`,
      json("DELETE"),
    );
    expect(deleted.status).toBe(200);

    expect(await grants(docs.private)).toEqual([]);
    expect((await open(world, member, docs.private)).status).toBe(404);
    expect((await open(world, limited, docs.private)).status).toBe(404);
  });
});
