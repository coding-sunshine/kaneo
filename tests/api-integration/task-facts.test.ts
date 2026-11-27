import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
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
import { pdfText } from "../../apps/api/src/scheduler/task-file-text";
import { textParts } from "../../apps/api/src/scheduler/text-parts";
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

/** A PDF with one line of text on each page, built by hand. "" is a page with no text. */
function pdf(pages: string[]) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...pages.flatMap((line, i) => {
      const stream = line ? `BT /F1 12 Tf 72 720 Td (${line}) Tj ET` : "";
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      ];
    }),
  ];
  let out = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const at of offsets) out += `${String(at).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

const describeIssue = (taskId: string, description: string) =>
  db.update(taskTable).set({ description }).where(eq(taskTable.id, taskId));
const comment = (world: DocumentWorld, taskId: string, content: string) =>
  db
    .insert(activityTable)
    .values({ taskId, type: "comment", content, userId: world.owner.id });
const attach = async (
  world: DocumentWorld,
  file: {
    id?: string;
    filename: string;
    mimeType: string;
    size?: number;
    kind?: string;
    surface?: string;
    activityId?: string;
  },
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

    it("does not read an issue again for an edit that changes only spaces", async () => {
      const { world } = await found();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await comment(world, world.betaTask.id, "Agreed with the team.");
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // The model reads the words with their spaces collapsed, so it would
      // read the same text again.
      await describeIssue(
        world.betaTask.id,
        `\n  ${LAUNCH.replace("settled:", "settled:\n\n   ")}  \n`,
      );
      await db
        .update(taskTable)
        .set({ title: " Beta   issue " })
        .where(eq(taskTable.id, world.betaTask.id));
      await db
        .update(activityTable)
        .set({ content: "Agreed  with the\nteam. " })
        .where(eq(activityTable.taskId, world.betaTask.id));
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // A change of words is read.
      await describeIssue(world.betaTask.id, `${LAUNCH} Signed.`);
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("keeps a record of an issue read before the spaces rule and does not read it again", async () => {
      const { world } = await found();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const spaced = LAUNCH.replace("settled:", "settled:  ");
      await describeIssue(world.betaTask.id, spaced);
      // As the build before wrote it: the hash of the words as they are stored.
      const before = createHash("md5")
        .update(`Beta issue\n${spaced}\n`)
        .digest("hex");
      await db
        .update(taskExtractionTable)
        .set({ contentHash: before })
        .where(eq(taskExtractionTable.taskId, world.betaTask.id));
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Nothing is read for a later edit of spaces either.
      await describeIssue(world.betaTask.id, LAUNCH);
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [kept] = await db
        .select()
        .from(taskExtractionTable)
        .where(eq(taskExtractionTable.taskId, world.betaTask.id));
      expect(kept?.contentHash).not.toBe(before);
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
        size: 150_000_000,
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
        size: 150_000_000,
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

    it("sends the whole of a long file to the model, part by part, and keeps a fact from its end", async () => {
      const { world, topicId } = await setup();
      const notes = await attach(world, {
        filename: "notes.md",
        mimeType: "text/markdown",
      });
      const long = `${Array.from({ length: 12_000 }, (_, i) => `Line ${i} says nothing.`).join("\n")}\n${PRICE}`;
      readObject.mockImplementation(async () => ({
        body: new Response(long).body,
      }));
      tells(fetchMock, PRICE, { topics: [NAMED], statements: [HOW_MUCH] });
      await run();

      const sent = prompts(fetchMock).filter((prompt) =>
        prompt.includes("notes.md"),
      );
      // Far more than the 10 parts a text was cut at before.
      expect(sent.length).toBe(textParts(long, 12_000, 200).length);
      expect(sent.length).toBeGreaterThan(20);
      expect(new Set(sent).size).toBe(sent.length);
      expect(sent.at(-1)).toContain(PRICE);
      const listed = await facts(world, topicId, world.owner);
      expect(listed).toMatchObject([
        { quote: "40 USD", file: { id: notes.id } },
      ]);
      const [record] = (await records()).filter(
        (row) => row.assetId === notes.id,
      );
      expect(record).toMatchObject({ readable: true, reason: null });
    });

    it("goes on with a long text in the next run where it stopped, sending no part twice", async () => {
      const { world } = await setup();
      const log = await attach(world, {
        filename: "server.log",
        mimeType: "text/plain",
      });
      const long = Array.from(
        { length: 60_000 },
        (_, i) => `Line ${i} of the log.`,
      ).join("\n");
      readObject.mockImplementation(async () => ({
        body: new Response(long).body,
      }));
      const ofLog = () =>
        prompts(fetchMock).filter((prompt) => prompt.includes("server.log"));
      await run();
      const first = ofLog().length;
      expect(first).toBeGreaterThan(0);
      expect(await records()).toHaveLength(2);
      for (let runs = 0; runs < 10; runs++) await run();

      const sent = ofLog();
      expect(first).toBeLessThan(sent.length);
      expect(sent.length).toBe(textParts(long, 12_000, 200).length);
      expect(new Set(sent).size).toBe(sent.length);
      const [record] = (await records()).filter(
        (row) => row.assetId === log.id,
      );
      expect(record).toMatchObject({ readable: true, reason: null });
    });

    it("reads once more each file the readers before this change cut short, found too large or could not read, and only once", async () => {
      const { world } = await setup();
      const cut = await attach(world, {
        filename: "cut.md",
        mimeType: "text/markdown",
      });
      const large = await attach(world, {
        filename: "large.zip",
        mimeType: "application/zip",
        size: 9_000_000,
      });
      const broken = await attach(world, {
        filename: "broken.zip",
        mimeType: "application/zip",
      });
      const huge = await attach(world, {
        filename: "huge.txt",
        mimeType: "text/plain",
        size: 150_000_000,
      });
      // A PDF read before, whose pages past the 50th were left out with no
      // reason given; this one has fewer, so its text is the same.
      const short = await attach(world, {
        filename: "short.pdf",
        mimeType: "application/pdf",
      });
      const shortPdf = pdf(["Launch notes"]);
      const bytes: Record<string, Uint8Array> = {
        [cut.objectKey]: strToU8(`# Cut\n\n${PRICE}`),
        [large.objectKey]: zipSync({ "notes.txt": strToU8(LAUNCH) }),
        [broken.objectKey]: strToU8("not a zip"),
        [short.objectKey]: shortPdf,
      };
      readObject.mockImplementation(async (key: string) => ({
        body: new Response(bytes[key]).body,
      }));
      const before = (assetId: string, reason: string | null, hash = "") =>
        db.insert(taskExtractionTable).values({
          taskId: world.betaTask.id,
          assetId,
          contentHash: hash,
          slotsHash: "before",
          promptVersion: 1,
          model: "before/model",
          readable: reason === "truncated" || reason === null,
          reason,
          createdAt: new Date(),
        });
      await before(cut.id, "truncated", "cut-before");
      await before(large.id, "too_large");
      await before(broken.id, "unparsed");
      await before(huge.id, "too_large");
      await before(
        short.id,
        null,
        createHash("sha256")
          .update(await pdfText(shortPdf))
          .digest("hex"),
      );
      await run();

      const sent = prompts(fetchMock);
      // Two issues, the cut file and the archive; the PDF's text is the same.
      expect(sent).toHaveLength(4);
      expect(sent.some((prompt) => prompt.includes(PRICE))).toBe(true);
      expect(sent.some((prompt) => prompt.includes(LAUNCH))).toBe(true);
      expect(readObject).toHaveBeenCalledTimes(4);
      const byFile = new Map(
        (await records()).map((row) => [row.assetId, row]),
      );
      expect(byFile.get(cut.id)).toMatchObject({ reason: null });
      expect(byFile.get(large.id)).toMatchObject({ reason: null });
      expect(byFile.get(broken.id)).toMatchObject({ reason: "unparsed" });
      expect(byFile.get(huge.id)).toMatchObject({ reason: "too_large" });
      expect(byFile.get(short.id)).toMatchObject({ reason: null });
      for (const row of byFile.values()) expect(row.promptVersion).toBe(2);

      // Read once: a file that is still not read is not tried again.
      await run();
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(readObject).toHaveBeenCalledTimes(4);
    });

    it("reads the smaller files first, so one file longer than a run does not hold back the rest", async () => {
      const { world } = await setup();
      // Ids sort the long file first, as on the server where it held the
      // whole run day after day.
      const long = await attach(world, {
        id: "a-long",
        filename: "long.log",
        mimeType: "text/plain",
        size: 1_200_000,
      });
      const small = await attach(world, {
        id: "z-small",
        filename: "small.md",
        mimeType: "text/markdown",
        size: 100,
      });
      const bytes: Record<string, string> = {
        [long.objectKey]: Array.from(
          { length: 60_000 },
          (_, i) => `Line ${i} of the log.`,
        ).join("\n"),
        [small.objectKey]: `# Small\n\n${PRICE}`,
      };
      readObject.mockImplementation(async (key: string) => ({
        body: new Response(bytes[key]).body,
      }));
      for (const assetId of [long.id, small.id]) {
        await db.insert(taskExtractionTable).values({
          taskId: world.betaTask.id,
          assetId,
          contentHash: `cut-${assetId}`,
          slotsHash: "before",
          promptVersion: 1,
          model: "before/model",
          readable: true,
          reason: "truncated",
          createdAt: new Date(),
        });
      }
      await run();

      const byFile = new Map(
        (await records()).map((row) => [row.assetId, row]),
      );
      expect(byFile.get(small.id)).toMatchObject({
        promptVersion: 2,
        reason: null,
      });
      expect(byFile.get(long.id)).toMatchObject({ promptVersion: 1 });
    });

    it("has the model write out a scanned PDF and a picture, and keeps the facts they state", async () => {
      const { world, topicId } = await setup();
      const scan = await attach(world, {
        filename: "scan.pdf",
        mimeType: "application/pdf",
      });
      const photo = await attach(world, {
        filename: "board.png",
        mimeType: "image/png",
      });
      const bytes: Record<string, Uint8Array> = {
        [scan.objectKey]: pdf(["", ""]),
        [photo.objectKey]: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      };
      readObject.mockImplementation(async (key: string) => ({
        body: new Response(bytes[key]).body,
      }));
      type Part = {
        type: string;
        text?: string;
        file?: { filename: string; file_data: string };
        image_url?: { url: string };
      };
      const seen: { body: Record<string, unknown>; parts: Part[] }[] = [];
      fetchMock.mockImplementation(
        async (_url: string, init: { body: string }) => {
          const body = JSON.parse(init.body);
          const content = body.messages[1].content as string | Part[];
          if (typeof content === "string") {
            if (content.includes(PRICE)) {
              return answer({ topics: [NAMED], statements: [HOW_MUCH] });
            }
            if (content.includes(LAUNCH)) {
              return answer({ topics: [NAMED], statements: [WHEN] });
            }
            return answer(NOTHING);
          }
          seen.push({ body, parts: content });
          const said = (text: string, more: boolean) =>
            new Response(
              JSON.stringify({
                choices: [
                  { message: { content: JSON.stringify({ text, more }) } },
                ],
                usage: { prompt_tokens: 900, completion_tokens: 40 },
              }),
            );
          if (content.some((part) => part.type === "image_url")) {
            return said(LAUNCH, false);
          }
          // A scan written out in two answers: the second goes on after the first.
          return content.some((part) => part.text?.includes("Cover words."))
            ? said(PRICE, false)
            : said("Cover words.", true);
        },
      );
      await run();

      const pdfCalls = seen.filter(({ parts }) =>
        parts.some((part) => part.type === "file"),
      );
      expect(pdfCalls).toHaveLength(2);
      const file = pdfCalls[0].parts.find((part) => part.type === "file");
      expect(file?.file?.filename).toBe("scan.pdf");
      expect(file?.file?.file_data).toMatch(/^data:application\/pdf;base64,/);
      // Read by the model itself, not sent on to an OCR service.
      expect(pdfCalls[0].body.plugins).toEqual([
        { id: "file-parser", pdf: { engine: "native" } },
      ]);
      const image = seen
        .flatMap(({ parts }) => parts)
        .find((part) => part.type === "image_url");
      expect(image?.image_url?.url).toMatch(/^data:image\/png;base64,/);

      const listed = await facts(world, topicId, world.owner);
      expect(
        listed.map((fact) => [fact.slot, fact.quote, fact.file?.id]).sort(),
      ).toEqual([
        ["launch_date", "5 March 2027", photo.id],
        ["price", "40 USD", scan.id],
      ]);
      const byFile = new Map(
        (await records()).map((row) => [row.assetId, row]),
      );
      expect(byFile.get(scan.id)).toMatchObject({
        readable: true,
        reason: null,
      });
      expect(byFile.get(photo.id)).toMatchObject({
        readable: true,
        reason: null,
      });
    });

    it("reads a picture inside an issue description and one inside a comment, each once", async () => {
      const { world, topicId } = await setup();
      const [said] = await db
        .insert(activityTable)
        .values({
          taskId: world.betaTask.id,
          type: "comment",
          content: "See the picture.",
          userId: world.owner.id,
        })
        .returning();
      const inText = await attach(world, {
        filename: "whiteboard.png",
        mimeType: "image/png",
        kind: "image",
        surface: "description",
      });
      const inComment = await attach(world, {
        filename: "receipt.jpg",
        mimeType: "image/jpeg",
        kind: "image",
        surface: "comment",
        activityId: said.id,
      });
      const words: Record<string, string> = {
        [inText.objectKey]: LAUNCH,
        [inComment.objectKey]: PRICE,
      };
      readObject.mockImplementation(async (key: string) => ({
        body: new Response(new TextEncoder().encode(key)).body,
      }));
      type Part = { type: string; image_url?: { url: string } };
      const pictures: string[] = [];
      fetchMock.mockImplementation(
        async (_url: string, init: { body: string }) => {
          const body = JSON.parse(init.body);
          const content = body.messages[1].content as string | Part[];
          if (typeof content !== "string") {
            const url =
              content.find((part) => part.type === "image_url")?.image_url
                ?.url ?? "";
            pictures.push(url);
            // The picture's bytes are its object key, so the answer is its words.
            const key = Buffer.from(
              url.split(",")[1] ?? "",
              "base64",
            ).toString();
            return new Response(
              JSON.stringify({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        text: words[key] ?? "",
                        more: false,
                      }),
                    },
                  },
                ],
                usage: { prompt_tokens: 900, completion_tokens: 40 },
              }),
            );
          }
          if (content.includes(PRICE)) {
            return answer({ topics: [NAMED], statements: [HOW_MUCH] });
          }
          if (content.includes(LAUNCH)) {
            return answer({ topics: [NAMED], statements: [WHEN] });
          }
          return answer(NOTHING);
        },
      );
      await run();

      expect(pictures).toHaveLength(2);
      expect(
        pictures.some((url) => url.startsWith("data:image/png;base64,")),
      ).toBe(true);
      expect(
        pictures.some((url) => url.startsWith("data:image/jpeg;base64,")),
      ).toBe(true);
      const byFile = new Map(
        (await records()).map((row) => [row.assetId, row]),
      );
      expect(byFile.get(inText.id)).toMatchObject({
        taskId: world.betaTask.id,
        readable: true,
        reason: null,
      });
      expect(byFile.get(inComment.id)).toMatchObject({
        taskId: world.betaTask.id,
        readable: true,
        reason: null,
      });
      const listed = await facts(world, topicId, world.owner);
      expect(listed.map((fact) => [fact.slot, fact.file?.id]).sort()).toEqual([
        ["launch_date", inText.id],
        ["price", inComment.id],
      ]);

      const asked = prompts(fetchMock).filter(
        (prompt) => typeof prompt === "string",
      );
      expect(
        asked.some((prompt) =>
          prompt.includes("Picture in the issue description whiteboard.png:"),
        ),
      ).toBe(true);
      expect(
        asked.some((prompt) =>
          prompt.includes("Picture in a comment on the issue receipt.jpg:"),
        ),
      ).toBe(true);

      // A picture is read once.
      const calls = fetchMock.mock.calls.length;
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(calls);
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
