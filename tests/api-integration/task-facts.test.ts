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
  topicSlotTable,
  topicTable,
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

    it("asks old texts once about a field added later", async () => {
      const { world, topicId } = await found();
      await attach(world, { filename: "notes.md", mimeType: "text/markdown" });
      // Two files that are not read: they stay out of every later run.
      await attach(world, {
        filename: "photo.heic",
        mimeType: "image/heic",
      });
      await attach(world, {
        filename: "big.md",
        mimeType: "text/markdown",
        size: 6_000_000,
      });
      readObject.mockImplementation(async () => ({
        body: new Response(PRICE).body,
      }));
      await run();
      // Two issues and one file.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(readObject).toHaveBeenCalledTimes(1);

      await filing(world).addSlot(topicId, { name: "State", type: "term" });
      fetchMock.mockClear();
      tells(fetchMock, "Beta issue", {
        topics: [NAMED],
        // The new slot is the only one in the question.
        statements: [
          {
            slot: "s1",
            about: "the launch plan",
            value: "settled",
            quote: "is settled",
          },
        ],
      });
      await run();

      const sent = prompts(fetchMock);
      expect(sent).toHaveLength(3);
      for (const prompt of sent) {
        expect(prompt).toContain("): State");
        expect(prompt).not.toContain("): Launch date");
        expect(prompt).not.toContain("): Price");
      }
      expect(
        (await facts(world, topicId, world.owner))
          .map((fact) => fact.slot)
          .sort(),
      ).toEqual(["launch_date", "state"]);

      await run();
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(
        (await records()).map((row) => row.reason ?? "read").sort(),
      ).toEqual(["read", "read", "read", "too_large", "unsupported"]);

      const lease = await filing(world).topic("Office lease");
      await filing(world).addSlot(lease, { name: "Rent", type: "number" });
      fetchMock.mockClear();
      await run();
      await run();

      const about = prompts(fetchMock);
      expect(about).toHaveLength(3);
      for (const prompt of about) {
        expect(prompt).toContain("Topic t1: Office lease");
        expect(prompt).not.toContain("): State");
      }
    });

    it("reads nothing again after a rename, a deletion or another model", async () => {
      const { world, topicId, price } = await found();
      await attach(world, { filename: "notes.md", mimeType: "text/markdown" });
      readObject.mockImplementation(async () => ({
        body: new Response(PRICE).body,
      }));
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(3);

      await db
        .update(topicTable)
        .set({ name: "Launch plan 2027" })
        .where(eq(topicTable.id, topicId));
      // The newest slot of the workspace.
      await db.delete(topicSlotTable).where(eq(topicSlotTable.id, price.id));
      vi.stubEnv("EXTRACTION_MODEL", "another/model");
      await run();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(await records()).toHaveLength(3);
    });

    it("does not read the same file text twice", async () => {
      const { world, topicId } = await setup();
      await attach(world, { filename: "notes.md", mimeType: "text/markdown" });
      await attach(world, { filename: "copy.md", mimeType: "text/markdown" });
      readObject.mockImplementation(async () => ({
        body: new Response(PRICE).body,
      }));
      const ofFiles = async () =>
        (await records()).filter((row) => row.assetId !== null);
      await run();

      // Two issues and one of the two files.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect((await ofFiles()).map((row) => row.reason).sort()).toEqual([
        "duplicate",
        null,
      ]);

      // A field added later is asked of the file that was read, not of its copy.
      await filing(world).addSlot(topicId, { name: "State", type: "term" });
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(6);

      // The file that was read goes. Its copy now holds the only text: it is read.
      const [read] = (await ofFiles()).filter((row) => row.reason === null);
      await db.delete(assetTable).where(eq(assetTable.id, read.assetId ?? ""));
      await run();
      await run();

      expect(fetchMock).toHaveBeenCalledTimes(7);
      expect((await ofFiles()).map((row) => row.reason)).toEqual([null]);
    });

    it("makes no call for records written before this build", async () => {
      const { world, topicId } = await found();
      await attach(world, { filename: "notes.md", mimeType: "text/markdown" });
      await attach(world, { filename: "copy.md", mimeType: "text/markdown" });
      readObject.mockImplementation(async () => ({
        body: new Response(PRICE).body,
      }));
      await run();
      // As the build before wrote them: the time of writing on each record,
      // both files read, and an older record left where the slots had changed.
      await db.update(taskExtractionTable).set({
        slotsHash: "before",
        model: "before/model",
        readable: true,
        reason: null,
        createdAt: new Date(),
      });
      const [issue] = (await records()).filter(
        (row) => row.taskId === world.betaTask.id && row.assetId === null,
      );
      await db.insert(taskExtractionTable).values({
        ...issue,
        id: undefined,
        slotsHash: "older",
        createdAt: new Date(0),
      });
      fetchMock.mockClear();
      await run();

      expect(fetchMock).not.toHaveBeenCalled();

      // A field added after the upgrade: once for each issue, once for the two files.
      await filing(world).addSlot(topicId, { name: "State", type: "term" });
      await run();
      await run();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      for (const prompt of prompts(fetchMock)) {
        expect(prompt).not.toContain("): Launch date");
      }
    });

    it("reads new words before it catches up on a new field", async () => {
      const { world, topicId } = await found();
      await filing(world).addSlot(topicId, { name: "State", type: "term" });
      // The issue the job reaches last gets the new comment.
      const alphaLast = world.alphaTask.id > world.betaTask.id;
      await comment(
        world,
        alphaLast ? world.alphaTask.id : world.betaTask.id,
        PRICE,
      );
      fetchMock.mockClear();
      await run();

      const sent = prompts(fetchMock);
      expect(sent).toHaveLength(2);
      // Every field for the new words, then the new field for the other issue.
      expect(sent[0]).toContain(alphaLast ? "Alpha issue" : "Beta issue");
      expect(sent[0]).toContain("): Launch date");
      expect(sent[1]).toContain(alphaLast ? "Beta issue" : "Alpha issue");
      expect(sent[1]).not.toContain("): Launch date");
      expect(sent[1]).toContain("): State");
    });

    it("asks about a field added while a run was on", async () => {
      const { topicId } = await setup();
      let added = false;
      fetchMock.mockImplementation(async () => {
        if (!added) {
          added = true;
          await db
            .insert(topicSlotTable)
            .values({ topicId, key: "state", name: "State", type: "term" });
        }
        return answer(NOTHING);
      });
      await run();
      // Two issues, asked before the field was there.
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await run();
      await run();

      const sent = prompts(fetchMock).slice(2);
      expect(sent).toHaveLength(2);
      for (const prompt of sent) {
        expect(prompt).toContain("): State");
        expect(prompt).not.toContain("): Launch date");
      }
    });

    it("sends words that came in while a run was on only once", async () => {
      const { world } = await setup();
      const alphaLast = world.alphaTask.id > world.betaTask.id;
      let said = false;
      fetchMock.mockImplementation(async () => {
        if (!said) {
          said = true;
          // On the issue the run has not reached yet.
          await comment(
            world,
            alphaLast ? world.alphaTask.id : world.betaTask.id,
            PRICE,
          );
        }
        return answer(NOTHING);
      });
      await run();
      await run();

      const sent = prompts(fetchMock);
      expect(sent).toHaveLength(2);
      expect(sent[1]).toContain(PRICE);
    });

    it("reads an issue again when an edit is undone, so its facts come back", async () => {
      const { world, topicId, fact } = await found();
      await describeIssue(world.betaTask.id, "Nothing is settled yet.");
      tells(fetchMock, "no such text", NOTHING);
      await run();
      expect(await facts(world, topicId, world.owner)).toEqual([]);

      await describeIssue(world.betaTask.id, LAUNCH);
      tells(fetchMock, "Beta issue", { topics: [NAMED], statements: [WHEN] });
      await run();
      await run();

      // Two issues, the edit and the undo.
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(
        (await facts(world, topicId, world.owner)).map((found) => found.value),
      ).toEqual([fact.value]);
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
        filename: "bundle.7z",
        mimeType: "application/x-7z-compressed",
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
