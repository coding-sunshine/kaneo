import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { eq } from "drizzle-orm";
import db from "../../apps/api/src/database";
import {
  activityTable,
  aiUsageTable,
  assetTable,
  notificationTable,
  taskExtractionTable,
  taskTable,
} from "../../apps/api/src/database/schema";
import { resetTestDatabase } from "./helpers/database";
import {
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import { createWorkspaceMember } from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { filing, type Member, setup } from "./helpers/statement-filing";

const { readObject } = vi.hoisted(() => ({ readObject: vi.fn() }));
vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPrivateObject: readObject,
}));

type Fact = {
  id: string;
  slot: string;
  slotName: string;
  value: string;
  quote: string;
  task: {
    id: string;
    title: string;
    number: number;
    projectId: string;
    projectSlug: string;
  };
  file: { id: string; filename: string } | null;
  onTopic: boolean;
  dismissed: boolean;
};
type Told = {
  topics: { topic: string; names_it: string }[];
  statements: { slot: string; about: string; value: string; quote: string }[];
};

const LAUNCH = "The Launch plan is settled: we launch on 5 March 2027.";
const PRICE = "Launch plan price: 40 USD per seat.";
const NOTHING: Told = { topics: [], statements: [] };
const NAMED = { topic: "t1", names_it: "Launch plan" };
const WHEN = {
  slot: "s1",
  about: "the launch plan",
  value: "2027-03-05",
  quote: "5 March 2027",
};
const HOW_MUCH = {
  slot: "s2",
  about: "the launch plan",
  value: "40",
  quote: "40 USD",
};

const answer = (told: Told, cost = 0.0002) =>
  new Response(
    JSON.stringify({
      model: "test/model",
      choices: [{ message: { content: JSON.stringify(told) } }],
      usage: { prompt_tokens: 120, completion_tokens: 30, cost },
    }),
  );
const job = () => import("../../apps/api/src/scheduler/task-extraction");
const run = async () => (await job()).extractTaskFacts();
const prompts = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(
    (call) =>
      JSON.parse((call as unknown as [string, { body: string }])[1].body)
        .messages[1].content as string,
  );
const records = () => db.select().from(taskExtractionTable);

// The model answers `told` about the issue or file whose text has `needle`,
// and finds nothing in every other text.
const tells = (
  fetchMock: ReturnType<typeof vi.fn>,
  needle: string,
  told: Told,
) =>
  fetchMock.mockImplementation(async (_url: string, init: { body: string }) =>
    answer(
      (JSON.parse(init.body).messages[1].content as string).includes(needle)
        ? told
        : NOTHING,
    ),
  );

const describeIssue = (taskId: string, description: string) =>
  db.update(taskTable).set({ description }).where(eq(taskTable.id, taskId));
const comment = (world: DocumentWorld, taskId: string, content: string) =>
  db
    .insert(activityTable)
    .values({ taskId, type: "comment", content, userId: world.owner.id });
const attach = async (
  world: DocumentWorld,
  file: { filename: string; mimeType: string; size?: number; kind?: string },
) =>
  (
    await db
      .insert(assetTable)
      .values({
        workspaceId: world.ws,
        projectId: world.beta.id,
        taskId: world.betaTask.id,
        objectKey: `key/${file.filename}`,
        size: 100,
        kind: "attachment",
        surface: "attachment",
        ...file,
      })
      .returning()
  )[0];

const base = (world: DocumentWorld, topicId: string) =>
  `/topic/workspace/${world.ws}/${topicId}/task-statement`;
const list = (world: DocumentWorld, topicId: string, user: Member) =>
  world.as(user)(base(world, topicId));
const facts = async (world: DocumentWorld, topicId: string, user: Member) => {
  const response = await list(world, topicId, user);
  expect(response.status, await response.clone().text()).toBe(200);
  return ((await response.json()) as { statements: Fact[] }).statements;
};
const dismiss = (
  world: DocumentWorld,
  topicId: string,
  factId: string,
  user: Member,
  method: "PUT" | "DELETE" = "PUT",
) =>
  world.as(user)(`${base(world, topicId)}/${factId}/dismissed`, json(method));

describe("API integration: facts found in issues", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await resetTestDatabase();
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    (await job()).taskExtractionRetry.reset();
    fetchMock = vi.fn(async () => answer(NOTHING));
    vi.stubGlobal("fetch", fetchMock);
    readObject.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // A topic in team Alpha with a date and a number slot, and a fact about it
  // in the issue of team Beta, which `limited` cannot enter.
  async function found() {
    const made = await setup();
    await describeIssue(made.world.betaTask.id, LAUNCH);
    tells(fetchMock, "Beta issue", { topics: [NAMED], statements: [WHEN] });
    await run();
    const [fact] = await facts(made.world, made.topicId, made.world.owner);
    return { ...made, fact };
  }

  describe("the job", () => {
    it("does nothing without an API key", async () => {
      vi.stubEnv("OPENROUTER_API_KEY", "");
      await setup();
      await run();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await records()).toEqual([]);
    });

    it("reads an issue's title, description and comments once and keeps the verbatim facts of the topics the issue names", async () => {
      const { world, topicId } = await setup();
      const other = await filing(world).topic("Office lease");
      await filing(world).addSlot(other, { name: "Rent", type: "number" });
      await describeIssue(world.betaTask.id, LAUNCH);
      await comment(world, world.betaTask.id, PRICE);
      tells(fetchMock, "Beta issue", {
        topics: [NAMED],
        statements: [
          WHEN,
          { ...HOW_MUCH, quote: "40 dollars" },
          // A slot of the topic the model did not list in step 1.
          { slot: "s3", about: "the rent", value: "40", quote: "40 USD" },
        ],
      });
      await run();

      const sent = prompts(fetchMock);
      expect(sent).toHaveLength(2);
      const beta = sent.find((prompt) => prompt.includes("Beta issue")) ?? "";
      for (const needle of [
        "Topic t1: Launch plan",
        "- s1 (date): Launch date",
        "- s2 (number): Price",
        "Topic t2: Office lease",
        "- s3 (number): Rent",
        "Title: Beta issue",
        LAUNCH,
        PRICE,
      ]) {
        expect(beta).toContain(needle);
      }

      const listed = await facts(world, topicId, world.owner);
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({
        slot: "launch_date",
        slotName: "Launch date",
        value: "2027-03-05",
        quote: "5 March 2027",
        task: {
          id: world.betaTask.id,
          title: "Beta issue",
          projectId: world.beta.id,
        },
        file: null,
        onTopic: false,
        dismissed: false,
      });
      expect(await facts(world, other, world.owner)).toEqual([]);
      expect(
        (await records()).map((row) => [row.assetId, row.readable, row.reason]),
      ).toEqual([
        [null, true, null],
        [null, true, null],
      ]);

      await run();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("reads an issue again after a new comment and does not propose the same fact twice", async () => {
      const { world, topicId } = await found();
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await comment(world, world.betaTask.id, PRICE);
      tells(fetchMock, "Beta issue", {
        topics: [NAMED],
        statements: [WHEN, HOW_MUCH],
      });
      await run();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(
        (await facts(world, topicId, world.owner)).map((fact) => fact.slot),
      ).toEqual(["launch_date", "price"]);
    });

    it("never reads the same text twice: not for a new topic, a new slot or another model", async () => {
      const { world, topicId } = await found();
      await attach(world, { filename: "notes.md", mimeType: "text/markdown" });
      readObject.mockImplementation(async () => ({
        body: new Response(PRICE).body,
      }));
      await run();
      // Two issues and one file.
      expect(fetchMock).toHaveBeenCalledTimes(3);

      const other = await filing(world).topic("Office lease");
      await filing(world).addSlot(other, { name: "Rent", type: "number" });
      await filing(world).addSlot(topicId, { name: "Owner", type: "term" });
      vi.stubEnv("EXTRACTION_MODEL", "another/model");
      await run();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(await records()).toHaveLength(3);
    });

    it("drops a fact when its words are no longer in the issue, unless a person dismissed it", async () => {
      const { world, topicId, fact } = await found();
      await comment(world, world.betaTask.id, PRICE);
      tells(fetchMock, "Beta issue", {
        topics: [NAMED],
        statements: [HOW_MUCH],
      });
      await run();
      const [price] = (await facts(world, topicId, world.owner)).filter(
        (listed) => listed.slot === "price",
      );
      await dismiss(world, topicId, price.id, world.owner);

      // Both passages are edited away. Nothing is found in the new text.
      await describeIssue(world.betaTask.id, "Plans changed.");
      await db.delete(activityTable);
      tells(fetchMock, "no such text", NOTHING);
      await run();

      const left = await facts(world, topicId, world.owner);
      expect(left.map((listed) => listed.id)).toEqual([price.id]);
      expect(left.map((listed) => listed.id)).not.toContain(fact.id);
    });

    it("reads a text file on an issue and records why another file was not read", async () => {
      const { world, topicId } = await setup();
      const notes = await attach(world, {
        filename: "notes.md",
        mimeType: "text/markdown",
      });
      const page = await attach(world, {
        filename: "page.html",
        mimeType: "text/html",
      });
      const zip = await attach(world, {
        filename: "bundle.zip",
        mimeType: "application/zip",
      });
      const big = await attach(world, {
        filename: "big.txt",
        mimeType: "text/plain",
        size: 50_000_000,
      });
      const texts: Record<string, string> = {
        [notes.objectKey]: `# Notes\n\n${PRICE}`,
        [page.objectKey]: `<style>p{color:red}</style><script>var hidden = 1;</script><p>${LAUNCH}</p>`,
      };
      readObject.mockImplementation(async (key: string) => ({
        body: new Response(texts[key]).body,
      }));
      tells(fetchMock, "notes.md", {
        topics: [NAMED],
        // The title is not the file: a quote from it does not count.
        statements: [HOW_MUCH, { ...WHEN, quote: "Beta issue" }],
      });
      await run();

      const sent = prompts(fetchMock);
      // Two issues and two files that can be read.
      expect(sent).toHaveLength(4);
      const file = sent.find((prompt) => prompt.includes("notes.md")) ?? "";
      expect(file).toContain("Title: Beta issue");
      expect(file).toContain(PRICE);
      const html = sent.find((prompt) => prompt.includes("page.html")) ?? "";
      expect(html).toContain(LAUNCH);
      expect(html).not.toContain("<p>");
      expect(html).not.toContain("hidden");
      expect(html).not.toContain("color:red");
      expect(readObject).toHaveBeenCalledTimes(2);

      const listed = await facts(world, topicId, world.owner);
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({
        slot: "price",
        quote: "40 USD",
        task: { id: world.betaTask.id },
        file: { id: notes.id, filename: "notes.md" },
      });
      const byFile = new Map(
        (await records()).map((row) => [row.assetId, row]),
      );
      expect(byFile.get(notes.id)).toMatchObject({ readable: true });
      expect(byFile.get(page.id)).toMatchObject({ readable: true });
      expect(byFile.get(zip.id)).toMatchObject({
        readable: false,
        reason: "unsupported",
      });
      expect(byFile.get(big.id)).toMatchObject({
        readable: false,
        reason: "too_large",
      });

      await run();
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(readObject).toHaveBeenCalledTimes(2);
    });

    it("keeps a record of an answer nobody could read, and none of a request that failed", async () => {
      await setup();
      fetchMock.mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "not json" } }],
              usage: { prompt_tokens: 10, completion_tokens: 2 },
            }),
          ),
      );
      await run();
      expect(
        (await records()).map((row) => [row.readable, row.reason]),
      ).toEqual([
        [false, "no_answer"],
        [false, "no_answer"],
      ]);

      await db.delete(taskExtractionTable);
      fetchMock.mockClear();
      fetchMock.mockImplementation(
        async () => new Response("down", { status: 500 }),
      );
      expect(await run()).toMatchObject({ degraded: true });
      expect(await records()).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      // Not asked again at once.
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("stops at its share of the day's tokens, so that documents are still read", async () => {
      vi.stubEnv("EXTRACTION_DAILY_TOKEN_CAP", "1000");
      await setup();
      const [used] = await db
        .insert(aiUsageTable)
        .values({
          purpose: "statements",
          model: "m",
          promptTokens: 700,
          completionTokens: 0,
        })
        .returning();
      await run();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await records()).toEqual([]);

      await db
        .update(aiUsageTable)
        .set({ promptTokens: 560 })
        .where(eq(aiUsageTable.id, used.id));
      await run();
      // 560 is under the share of 700. The one call uses 150 tokens, and 710
      // is not: the second issue waits.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(await records()).toHaveLength(1);
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("tells nobody: no notification is written", async () => {
      const made = await setup();
      const before = (await db.select().from(notificationTable)).length;
      await describeIssue(made.world.betaTask.id, LAUNCH);
      tells(fetchMock, "Beta issue", { topics: [NAMED], statements: [WHEN] });
      await run();
      const [fact] = await facts(made.world, made.topicId, made.world.owner);
      await dismiss(made.world, made.topicId, fact.id, made.world.owner);
      expect(await db.select().from(notificationTable)).toHaveLength(before);
    });
  });

  describe("who sees a fact", () => {
    it("shows it only to a person who can open the issue it is from", async () => {
      const { world, topicId, fact } = await found();
      expect(fact.task.title).toBe("Beta issue");
      expect(await facts(world, topicId, world.open)).toHaveLength(1);

      // `limited` opens the topic, which is in team Alpha, but not team Beta.
      const response = await list(world, topicId, world.limited);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(JSON.parse(text)).toEqual({ statements: [] });
      expect(text).not.toContain("Beta issue");
      expect(text).not.toContain("5 March 2027");
    });

    it("answers a topic the person cannot open like one that does not exist", async () => {
      const { world } = await setup();
      const api = filing(world);
      // A topic in team Beta, with a fact from the issue of team Alpha.
      const hidden = (
        (await (
          await world.as(world.owner)(
            "/topic",
            json("POST", {
              workspaceId: world.ws,
              name: "Beta plan",
              projectId: world.beta.id,
            }),
          )
        ).json()) as { id: string }
      ).id;
      await api.addSlot(hidden, { name: "Budget", type: "number" });
      await describeIssue(
        world.alphaTask.id,
        "The Beta plan budget is 40 USD.",
      );
      tells(fetchMock, "Alpha issue", {
        topics: [{ topic: "t1", names_it: "Beta plan" }],
        statements: [
          { slot: "s1", about: "the plan", value: "40", quote: "40 USD" },
        ],
      });
      await run();
      const [fact] = await facts(world, hidden, world.owner);
      expect(fact.task.title).toBe("Alpha issue");

      const missing = await list(world, "no-such-topic", world.limited);
      const read = await list(world, hidden, world.limited);
      expect(read.status).toBe(404);
      expect(await read.text()).toBe(await missing.text());
      for (const method of ["PUT", "DELETE"] as const) {
        const refused = await dismiss(
          world,
          hidden,
          fact.id,
          world.limited,
          method,
        );
        expect(refused.status).toBe(404);
        expect(await refused.text()).not.toContain("40 USD");
      }
      expect((await facts(world, hidden, world.owner))[0]?.dismissed).toBe(
        false,
      );
    });

    it("keeps a fact from a file to the people who can open its issue", async () => {
      const { world, topicId } = await setup();
      const notes = await attach(world, {
        filename: "notes.md",
        mimeType: "text/markdown",
      });
      readObject.mockResolvedValue({ body: new Response(PRICE).body });
      tells(fetchMock, "notes.md", { topics: [NAMED], statements: [HOW_MUCH] });
      await run();

      const [fact] = await facts(world, topicId, world.open);
      expect(fact.file).toEqual({ id: notes.id, filename: "notes.md" });
      const response = await list(world, topicId, world.limited);
      const text = await response.text();
      expect(JSON.parse(text)).toEqual({ statements: [] });
      expect(text).not.toContain("notes.md");
      expect(
        (await dismiss(world, topicId, fact.id, world.limited)).status,
      ).toBe(404);
    });

    it("keeps someone outside the workspace away", async () => {
      const { world, topicId, fact } = await found();
      const outsider = (await createWorkspaceMember({ role: "owner" })).user;
      const read = await list(world, topicId, outsider);
      expect(read.status).toBeGreaterThanOrEqual(400);
      expect(await read.text()).not.toContain("5 March 2027");
      expect(
        (await dismiss(world, topicId, fact.id, outsider)).status,
      ).toBeGreaterThanOrEqual(400);
      expect((await facts(world, topicId, world.owner))[0]?.dismissed).toBe(
        false,
      );
    });
  });

  describe("what a person does with a fact", () => {
    it("lets a member who can open both dismiss it and bring it back", async () => {
      const { world, topicId, fact } = await found();

      const dismissed = await dismiss(world, topicId, fact.id, world.open);
      expect(dismissed.status).toBe(200);
      expect(await dismissed.json()).toEqual({ id: fact.id, dismissed: true });
      expect((await facts(world, topicId, world.owner))[0]?.dismissed).toBe(
        true,
      );

      const restored = await dismiss(
        world,
        topicId,
        fact.id,
        world.open,
        "DELETE",
      );
      expect(restored.status).toBe(200);
      expect(await restored.json()).toEqual({ id: fact.id, dismissed: false });
      expect((await facts(world, topicId, world.owner))[0]?.dismissed).toBe(
        false,
      );
    });

    it("lets a viewer read a fact but not dismiss it or bring it back", async () => {
      const { world, topicId, fact } = await found();
      const viewer = await addWorkspaceMember(world.ws, "viewer");
      expect(await facts(world, topicId, viewer)).toHaveLength(1);

      expect((await dismiss(world, topicId, fact.id, viewer)).status).toBe(403);
      await dismiss(world, topicId, fact.id, world.owner);
      expect(
        (await dismiss(world, topicId, fact.id, viewer, "DELETE")).status,
      ).toBe(403);
      expect((await facts(world, topicId, world.owner))[0]?.dismissed).toBe(
        true,
      );
    });

    it("refuses a person who cannot open the issue, like a fact that does not exist", async () => {
      const { world, topicId, fact } = await found();
      const unknown = await dismiss(world, topicId, "no-such", world.limited);
      const refused = await dismiss(world, topicId, fact.id, world.limited);
      expect(refused.status).toBe(404);
      expect(await refused.text()).toBe(await unknown.text());
      expect((await facts(world, topicId, world.owner))[0]?.dismissed).toBe(
        false,
      );
    });

    it("reaches a fact only through its own topic", async () => {
      const { world, topicId, fact } = await found();
      const other = await filing(world).topic("Office lease");
      expect((await dismiss(world, other, fact.id, world.owner)).status).toBe(
        404,
      );
      expect((await facts(world, topicId, world.owner))[0]?.dismissed).toBe(
        false,
      );
    });

    it("shows whether the issue is on the topic, which only the link changes", async () => {
      const { world, topicId, fact } = await found();
      const link = `/topic/workspace/${world.ws}/${topicId}/task/${fact.task.id}`;

      expect((await world.as(world.open)(link, json("PUT"))).status).toBe(200);
      expect((await facts(world, topicId, world.owner))[0]?.onTopic).toBe(true);
      expect((await world.as(world.open)(link, json("DELETE"))).status).toBe(
        200,
      );
      expect((await facts(world, topicId, world.owner))[0]?.onTopic).toBe(
        false,
      );
    });
  });
});
