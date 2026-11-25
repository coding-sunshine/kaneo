import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { taskTopicTable } from "../../apps/api/src/database/schema";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

type Member = DocumentWorld["owner"];
type Issue = {
  topicId: string;
  id: string;
  title: string;
  number: number;
  projectId: string;
  projectSlug: string;
  status: string;
  closed: boolean;
};
type Topic = {
  id: string;
  name: string;
  currentDocumentTitle: string | null;
  tasks?: Issue[];
};

const base = (world: DocumentWorld) => `/topic/workspace/${world.ws}`;

const createTopic = async (
  world: DocumentWorld,
  user: Member,
  name: string,
  projectId?: string,
) => {
  const response = await world.as(user)(
    "/topic",
    json("POST", {
      workspaceId: world.ws,
      name,
      ...(projectId ? { projectId } : {}),
    }),
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: string }).id;
};
const write = async (world: DocumentWorld, title: string) => {
  const response = await world.as(world.owner)(
    "/document",
    json("POST", { workspaceId: world.ws, title, content: `<p>${title}</p>` }),
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: string }).id;
};
const file = async (world: DocumentWorld, topicId: string, docId: string) => {
  const response = await world.as(world.owner)(
    `${base(world)}/${topicId}/document/${docId}`,
    json("PUT"),
  );
  expect(response.status).toBe(200);
};
const makeCurrent = async (
  world: DocumentWorld,
  topicId: string,
  docId: string,
) => {
  const response = await world.as(world.owner)(
    `${base(world)}/${topicId}/document/${docId}/current`,
    json("POST", { reason: "The first version is the one to use." }),
  );
  expect(response.status).toBe(200);
};
// A topic with a current document, and with a filed proposal when asked.
const topicWithDocument = async (
  world: DocumentWorld,
  name: string,
  title: string,
  projectId?: string,
) => {
  const topicId = await createTopic(world, world.owner, name, projectId);
  const docId = await write(world, title);
  await file(world, topicId, docId);
  await makeCurrent(world, topicId, docId);
  return { topicId, docId };
};
const topics = async (world: DocumentWorld, user: Member, query = "") => {
  const response = await world.as(user)(`${base(world)}${query}`);
  expect(response.status).toBe(200);
  return (await response.json()) as Topic[];
};
const put = (
  world: DocumentWorld,
  user: Member,
  topicId: string,
  taskId: string,
) => world.as(user)(`${base(world)}/${topicId}/task/${taskId}`, json("PUT"));
const remove = (
  world: DocumentWorld,
  user: Member,
  topicId: string,
  taskId: string,
) => world.as(user)(`${base(world)}/${topicId}/task/${taskId}`, json("DELETE"));
const issuesOf = async (
  world: DocumentWorld,
  user: Member,
  topicId: string,
) => {
  const response = await world.as(user)(`${base(world)}/${topicId}/task`);
  expect(response.status).toBe(200);
  return ((await response.json()) as { tasks: Issue[] }).tasks;
};
const topicsOf = (world: DocumentWorld, user: Member, taskId: string) =>
  world.as(user)(`${base(world)}/task/${taskId}/topics`);
const links = () => db.select().from(taskTopicTable);
const answer = async (response: Response) => ({
  status: response.status,
  body: await response.text(),
});
const notificationCount = async () =>
  (await db.select().from(schema.notificationTable)).length;

const NO_TOPIC = "Topic not found";
const NO_ISSUE = "Issue not found";

describe("API integration: issues on a topic", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lists the title of the current document on each topic, null before there is one", async () => {
    const world = await buildDocumentWorld();
    const topicId = await createTopic(world, world.owner, "Launch plan");

    const before = await topics(world, world.owner);
    expect(
      before.find((t) => t.id === topicId)?.currentDocumentTitle,
    ).toBeNull();

    const docId = await write(world, "Launch plan, first version");
    await file(world, topicId, docId);
    await makeCurrent(world, topicId, docId);

    const after = await topics(world, world.owner);
    expect(after.find((t) => t.id === topicId)?.currentDocumentTitle).toBe(
      "Launch plan, first version",
    );
  });

  it("finds a topic by its name inside a sentence in any case, and never one the reader cannot open", async () => {
    const world = await buildDocumentWorld();
    const open = await createTopic(world, world.owner, "Launch plan");
    const hidden = await createTopic(
      world,
      world.owner,
      "Beta rollout",
      world.beta.id,
    );

    const found = await topics(
      world,
      world.limited,
      `?match=${encodeURIComponent("What is the LAUNCH PLAN status?")}`,
    );
    expect(found.map((t) => t.id)).toEqual([open]);

    expect(
      await topics(
        world,
        world.limited,
        `?match=${encodeURIComponent("Nothing here names a topic")}`,
      ),
    ).toEqual([]);

    const sentence = `?match=${encodeURIComponent("any news on the beta rollout?")}`;
    expect(await topics(world, world.limited, sentence)).toEqual([]);
    expect(
      (await topics(world, world.owner, sentence)).map((t) => t.id),
    ).toEqual([hidden]);
  });

  it("gives a null current document title to a reader who cannot open that document", async () => {
    const world = await buildDocumentWorld();
    const { topicId, docId } = await topicWithDocument(
      world,
      "Launch plan",
      "Launch plan, first version",
    );
    // Direct row update: moving a document into a team has no route that keeps it current.
    await db
      .update(schema.documentTable)
      .set({ scope: "team", projectId: world.beta.id })
      .where(eq(schema.documentTable.id, docId));

    const titleFor = async (user: Member) =>
      (await topics(world, user)).find((t) => t.id === topicId)
        ?.currentDocumentTitle;
    expect(await titleFor(world.limited)).toBeNull();
    expect(await titleFor(world.open)).toBe("Launch plan, first version");
  });

  it("puts an issue on a topic and lists it with its fields, once however often it is put", async () => {
    const world = await buildDocumentWorld();
    const topicId = await createTopic(world, world.owner, "Launch plan");
    const { alphaTask } = world;

    const first = await put(world, world.owner, topicId, alphaTask.id);
    expect(first.status).toBe(200);
    const second = await put(world, world.owner, topicId, alphaTask.id);
    expect(second.status).toBe(200);

    const expected: Issue = {
      topicId,
      id: alphaTask.id,
      title: "Alpha issue",
      number: 1,
      projectId: world.alpha.id,
      projectSlug: "alpha",
      status: "to-do",
      closed: false,
    };
    expect(await issuesOf(world, world.owner, topicId)).toEqual([expected]);
    expect(((await second.json()) as { tasks: Issue[] }).tasks).toEqual([
      expected,
    ]);
    expect(await links()).toHaveLength(1);
  });

  it("leaves out of the topic's issue list an issue in a team the reader cannot enter", async () => {
    const world = await buildDocumentWorld();
    const topicId = await createTopic(world, world.owner, "Launch plan");
    await put(world, world.owner, topicId, world.betaTask.id);
    await put(world, world.owner, topicId, world.alphaTask.id);

    const seen = async (user: Member) =>
      (await issuesOf(world, user, topicId)).map((t) => t.projectSlug);
    expect(await seen(world.limited)).toEqual(["alpha"]);
    expect(await seen(world.open)).toEqual(["alpha", "beta"]);
  });

  it("marks an issue closed once it is done", async () => {
    const world = await buildDocumentWorld();
    const topicId = await createTopic(world, world.owner, "Launch plan");
    await put(world, world.owner, topicId, world.alphaTask.id);

    const moved = await world.as(world.owner)(
      `/task/status/${world.alphaTask.id}`,
      json("PUT", { status: "done" }),
    );
    expect(moved.status).toBe(200);

    const [issue] = await issuesOf(world, world.owner, topicId);
    expect(issue).toMatchObject({ status: "done", closed: true });
  });

  it("answers a hidden topic or issue on PUT exactly like an unknown one", async () => {
    const world = await buildDocumentWorld();
    const elsewhere = await buildDocumentWorld();
    const { owner, limited, alphaTask, betaTask } = world;
    const topicId = await createTopic(world, owner, "Launch plan");
    const hiddenTopic = await createTopic(
      world,
      owner,
      "Beta plan",
      world.beta.id,
    );
    const foreignTopic = await createTopic(
      elsewhere,
      elsewhere.owner,
      "Other plan",
    );

    const unknown = await answer(
      await put(world, owner, "no-such-topic", alphaTask.id),
    );
    expect(unknown.status).toBe(404);
    expect(unknown.body).toContain(NO_TOPIC);
    expect(
      await answer(await put(world, limited, hiddenTopic, alphaTask.id)),
    ).toEqual(unknown);
    expect(
      await answer(await put(world, owner, foreignTopic, alphaTask.id)),
    ).toEqual(unknown);

    const noIssue = await answer(
      await put(world, owner, topicId, "no-such-issue"),
    );
    expect(noIssue.status).toBe(404);
    expect(noIssue.body).toContain(NO_ISSUE);
    expect(
      await answer(await put(world, limited, topicId, betaTask.id)),
    ).toEqual(noIssue);
    expect(
      await answer(await put(world, owner, topicId, elsewhere.alphaTask.id)),
    ).toEqual(noIssue);

    expect(await links()).toEqual([]);
  });

  it("takes an issue off a topic, twice without harm, with the same 404s as PUT", async () => {
    const world = await buildDocumentWorld();
    const elsewhere = await buildDocumentWorld();
    const { owner, limited, alphaTask, betaTask } = world;
    const topicId = await createTopic(world, owner, "Launch plan");
    const hiddenTopic = await createTopic(
      world,
      owner,
      "Beta plan",
      world.beta.id,
    );
    const foreignTopic = await createTopic(
      elsewhere,
      elsewhere.owner,
      "Other plan",
    );
    await put(world, owner, topicId, alphaTask.id);

    const first = await remove(world, owner, topicId, alphaTask.id);
    expect(first.status).toBe(200);
    expect(((await first.json()) as { tasks: Issue[] }).tasks).toEqual([]);
    expect((await remove(world, owner, topicId, alphaTask.id)).status).toBe(
      200,
    );
    expect(await links()).toEqual([]);

    const unknown = await answer(
      await remove(world, owner, "no-such-topic", alphaTask.id),
    );
    expect(unknown.status).toBe(404);
    expect(unknown.body).toContain(NO_TOPIC);
    expect(
      await answer(await remove(world, limited, hiddenTopic, alphaTask.id)),
    ).toEqual(unknown);
    expect(
      await answer(await remove(world, owner, foreignTopic, alphaTask.id)),
    ).toEqual(unknown);

    const noIssue = await answer(
      await remove(world, owner, topicId, "no-such-issue"),
    );
    expect(noIssue.status).toBe(404);
    expect(noIssue.body).toContain(NO_ISSUE);
    expect(
      await answer(await remove(world, limited, topicId, betaTask.id)),
    ).toEqual(noIssue);
    expect(
      await answer(await remove(world, owner, topicId, elsewhere.alphaTask.id)),
    ).toEqual(noIssue);
  });

  it("lists the topics an issue is on that the reader can open", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open, alphaTask } = world;
    const wide = await createTopic(world, owner, "Launch plan");
    const inBeta = await createTopic(world, owner, "Beta plan", world.beta.id);
    await put(world, owner, wide, alphaTask.id);
    await put(world, owner, inBeta, alphaTask.id);

    const idsFor = async (user: Member) => {
      const response = await topicsOf(world, user, alphaTask.id);
      expect(response.status).toBe(200);
      return ((await response.json()) as Topic[]).map((t) => t.id).sort();
    };
    expect(await idsFor(limited)).toEqual([wide]);
    expect(await idsFor(open)).toEqual([wide, inBeta].sort());

    const noIssue = await answer(await topicsOf(world, owner, "no-such-issue"));
    expect(noIssue.status).toBe(404);
    expect(noIssue.body).toContain(NO_ISSUE);
    expect(
      await answer(await topicsOf(world, limited, world.betaTask.id)),
    ).toEqual(noIssue);
  });

  it("puts a new issue on the topic named when it is created", async () => {
    const world = await buildDocumentWorld();
    const topicId = await createTopic(world, world.owner, "Launch plan");

    const created = await world.as(world.owner)(
      `/task/${world.alpha.id}`,
      json("POST", {
        title: "Fresh issue",
        description: "",
        priority: "low",
        status: "to-do",
        topicId,
      }),
    );
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };

    expect(
      (await issuesOf(world, world.owner, topicId)).map((t) => t.id),
    ).toEqual([id]);
  });

  it("refuses to create an issue on a hidden or unknown topic, and creates none", async () => {
    const world = await buildDocumentWorld();
    const hiddenTopic = await createTopic(
      world,
      world.owner,
      "Beta plan",
      world.beta.id,
    );
    const create = (topicId: string) =>
      world.as(world.limited)(
        `/task/${world.alpha.id}`,
        json("POST", {
          title: "Fresh issue",
          description: "",
          priority: "low",
          status: "to-do",
          topicId,
        }),
      );
    const tasks = async () => (await db.select().from(schema.taskTable)).length;
    const before = await tasks();

    const hidden = await answer(await create(hiddenTopic));
    const unknown = await answer(await create("no-such-topic"));

    expect(hidden.status).toBe(404);
    expect(hidden.body).toContain(NO_TOPIC);
    expect(unknown).toEqual(hidden);
    expect(await tasks()).toBe(before);
    expect(await links()).toEqual([]);
  });

  it("gives each topic of current and unreviewed only the issues the reader can open", async () => {
    const world = await buildDocumentWorld();
    const { topicId } = await topicWithDocument(
      world,
      "Launch plan",
      "Launch plan, first version",
    );
    await file(
      world,
      topicId,
      await write(world, "Launch plan, second version"),
    );
    await put(world, world.owner, topicId, world.alphaTask.id);
    await put(world, world.owner, topicId, world.betaTask.id);

    for (const route of ["current", "unreviewed"]) {
      const read = async (user: Member) => {
        const response = await world.as(user)(
          `${base(world)}/${route}?topic=${topicId}`,
        );
        expect(response.status).toBe(200);
        const body = (await response.json()) as { topics: Topic[] };
        return body.topics
          .find((t) => t.id === topicId)
          ?.tasks?.map((t) => t.projectSlug);
      };
      expect(await read(world.limited)).toEqual(["alpha"]);
      expect(await read(world.open)).toEqual(["alpha", "beta"]);
    }
  });

  it("writes no notification when an issue is linked or unlinked", async () => {
    const world = await buildDocumentWorld();
    const topicId = await createTopic(world, world.owner, "Launch plan");
    const before = await notificationCount();

    await put(world, world.owner, topicId, world.alphaTask.id);
    await remove(world, world.owner, topicId, world.alphaTask.id);

    expect(await notificationCount()).toBe(before);
  });

  it("drops a deleted issue from the topic's list", async () => {
    const world = await buildDocumentWorld();
    const topicId = await createTopic(world, world.owner, "Launch plan");
    await put(world, world.owner, topicId, world.alphaTask.id);
    await put(world, world.owner, topicId, world.betaTask.id);

    const deleted = await world.as(world.owner)(
      `/task/${world.alphaTask.id}`,
      json("DELETE"),
    );
    expect(deleted.status).toBe(200);

    expect(
      (await issuesOf(world, world.owner, topicId)).map((t) => t.id),
    ).toEqual([world.betaTask.id]);
  });

  it("answers 403 to a member whose role cannot update issues", async () => {
    const world = await buildDocumentWorld();
    const viewer = await addWorkspaceMember(world.ws, "viewer");
    const topicId = await createTopic(world, world.owner, "Launch plan");
    await put(world, world.owner, topicId, world.alphaTask.id);

    expect((await put(world, viewer, topicId, world.betaTask.id)).status).toBe(
      403,
    );
    expect(
      (await remove(world, viewer, topicId, world.alphaTask.id)).status,
    ).toBe(403);
    expect((await links()).map((l) => l.taskId)).toEqual([world.alphaTask.id]);
  });
});
