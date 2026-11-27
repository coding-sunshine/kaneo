import { and, eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db from "../../apps/api/src/database";
import {
  aiUsageTable,
  documentTable,
  notificationTable,
  statementJudgementTable,
} from "../../apps/api/src/database/schema";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import { filing, type Member, type Said } from "./helpers/statement-filing";

const NAMES = ["Codename", "Region", "Team", "Site", "Tool", "Mascot"];
const word = (base: string, i: number) => (i === 0 ? base : `${base} ${i + 1}`);
const said = (name: string, i: number, base: string): Said => ({
  slot: name.toLowerCase(),
  value: word(base, i),
  quote: word(base, i),
});
const textOf = (names: string[], base: string) =>
  "<p>The budget is 900 USD.</p>" +
  names.map((n, i) => `<p>The ${n} is ${word(base, i)}.</p>`).join("");

async function expectStatus(response: Response, status: number) {
  expect(response.status, await response.clone().text()).toBe(status);
}

type World = Awaited<ReturnType<typeof buildDocumentWorld>>;

async function fileAs(
  world: World,
  topicId: string,
  user: Member,
  title: string,
  content: string,
) {
  const made = await world.as(user)(
    "/document",
    json("POST", {
      workspaceId: world.ws,
      title,
      content,
      projectId: world.alpha.id,
    }),
  );
  await expectStatus(made, 200);
  const { id } = (await made.json()) as { id: string };
  await expectStatus(
    await world.as(user)(
      `/topic/workspace/${world.ws}/${topicId}/document/${id}`,
      json("PUT"),
    ),
    200,
  );
  return id;
}

async function stateAs(
  api: ReturnType<typeof filing>,
  id: string,
  names: string[],
  base: string,
  user: Member,
) {
  for (const [i, name] of names.entries()) {
    await expectStatus(await api.post(id, said(name, i, base), user), 200);
  }
}

// A topic with confirmed current statements (Falcon...) and an incoming
// document that words the same terms differently (Kestrel...).
async function scene(
  options: {
    decider?: "owner" | "limited";
    author?: "owner" | "limited";
    terms?: number;
  } = {},
) {
  const world = await buildDocumentWorld();
  const api = filing(world);
  const names = NAMES.slice(0, options.terms ?? 1);
  const decider = world[options.decider ?? "owner"];
  const author = world[options.author ?? "owner"];
  const created = await world.as(world.owner)(
    "/topic",
    json("POST", {
      workspaceId: world.ws,
      name: "Launch plan",
      projectId: world.alpha.id,
      deciderId: decider.id,
    }),
  );
  await expectStatus(created, 200);
  const { id: topicId } = (await created.json()) as { id: string };
  for (const name of names) {
    await api.addSlot(topicId, { name, type: "term" });
  }
  const currentId = await fileAs(
    world,
    topicId,
    world.owner,
    "Launch plan",
    textOf(names, "Falcon"),
  );
  for (const [i, name] of names.entries()) {
    const statement = await api.add(currentId, said(name, i, "Falcon"));
    await expectStatus(
      await api.decide(currentId, statement.id, "confirm"),
      200,
    );
  }
  await expectStatus(await api.approve(topicId, currentId), 200);

  const incomingId = await fileAs(
    world,
    topicId,
    author,
    "Launch plan v2",
    textOf(names, "Kestrel"),
  );
  await stateAs(api, incomingId, names, "Kestrel", author);
  return { world, api, topicId, currentId, incomingId, names, decider };
}

describe("API integration: conflict questions", () => {
  const reply = (content: string) =>
    new Response(
      JSON.stringify({
        model: "test/model",
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 40, completion_tokens: 5, total_tokens: 45 },
      }),
    );
  const answer = (contradicts: unknown) =>
    reply(JSON.stringify({ contradicts }));
  const run = async () =>
    (
      await import("../../apps/api/src/scheduler/conflict-questions")
    ).askConflictQuestions();
  const body = (call = 0) =>
    JSON.parse(
      (fetchMock.mock.calls[call] as unknown as [string, { body: string }])[1]
        .body,
    );
  const judgements = () => db.select().from(statementJudgementTable);
  const questions = (userId: string) =>
    db
      .select()
      .from(notificationTable)
      .where(
        and(
          eq(notificationTable.userId, userId),
          eq(notificationTable.type, "document_question"),
        ),
      );
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await resetTestDatabase();
    // The wait after a failed request lives in the process, not the database.
    (
      await import("../../apps/api/src/scheduler/conflict-questions")
    ).conflictRetry.reset();
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    fetchMock = vi.fn(async () => answer(true));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("turns a pair the model calls contradictory into a conflict and asks the decider", async () => {
    const { api, topicId, incomingId, decider } = await scene();
    expect((await api.receipt(incomingId)).unjudged).toHaveLength(1);

    await run();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const receipt = await api.receipt(incomingId);
    expect(receipt.unjudged).toEqual([]);
    expect(receipt.conflicts).toHaveLength(1);
    expect(receipt.conflicts[0]).toMatchObject({
      slot: "codename",
      status: "open",
    });
    await expectStatus(await api.approve(topicId, incomingId), 409);

    await expectStatus(
      await api.settleConflict(incomingId, receipt.conflicts[0].id, {
        decision: "replace",
        reason: "Renamed.",
      }),
      200,
    );
    await expectStatus(await api.approve(topicId, incomingId), 200);

    const rows = await questions(decider.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "document_question",
      resourceId: incomingId,
    });
  });

  it("files a pair the model calls compatible as a repeat and stays quiet", async () => {
    fetchMock.mockImplementation(async () => answer(false));
    const { api, topicId, incomingId, decider } = await scene();
    await run();

    const receipt = await api.receipt(incomingId);
    expect(receipt.repeats).toHaveLength(1);
    expect(receipt.unjudged).toEqual([]);
    expect(receipt.conflicts).toEqual([]);
    await expectStatus(await api.approve(topicId, incomingId), 200);
    expect(await questions(decider.id)).toEqual([]);
  });

  it("stores one judgement and reuses it for the same texts", async () => {
    const { world, api, topicId, names } = await scene();
    await run();
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const rows = await judgements();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ contradicts: true });
    expect(rows[0].textsHash).toEqual(expect.any(String));
    expect(rows[0].createdAt).toBeInstanceOf(Date);

    const again = await fileAs(
      world,
      topicId,
      world.owner,
      "Launch plan v3",
      textOf(names, "Kestrel"),
    );
    await stateAs(api, again, names, "Kestrel", world.owner);
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const receipt = await api.receipt(again);
    expect(receipt.conflicts).toHaveLength(1);
    expect(receipt.unjudged).toEqual([]);
  });

  it("sends only the slot name and the two statements", async () => {
    await scene();
    await run();

    const sent = body();
    expect(sent.stream).toBe(false);
    expect(sent.provider.zdr).toBe(true);
    expect(sent.provider.data_collection).toBe("deny");
    const messages = JSON.stringify(sent.messages);
    for (const needle of ["Codename", "Falcon", "Kestrel"]) {
      expect(messages).toContain(needle);
    }
    expect(messages).not.toContain("900 USD");
  });

  it("asks nothing without an API key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const { api, incomingId } = await scene();
    await run();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await judgements()).toEqual([]);
    expect((await api.receipt(incomingId)).unjudged).toHaveLength(1);
  });

  it("stops at the workspace's daily token cap", async () => {
    vi.stubEnv("EXTRACTION_DAILY_TOKEN_CAP", "1000");
    const { world } = await scene();
    await db.insert(aiUsageTable).values({
      purpose: "statements",
      workspaceId: world.ws,
      model: "test/model",
      promptTokens: 1000,
      completionTokens: 0,
    });
    await run();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a server error", async () => new Response("no", { status: 500 })],
    [
      "a network error",
      async () => {
        throw new Error("down");
      },
    ],
  ])(
    "keeps no row after %s and asks again an hour later",
    async (_name, fail) => {
      fetchMock.mockImplementation(fail);
      const { api, topicId, incomingId } = await scene();
      await expect(run()).resolves.not.toThrow();
      expect(await judgements()).toEqual([]);
      expect((await api.receipt(incomingId)).unjudged).toHaveLength(1);

      // Within the hour the failed request is not sent again.
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const clock = vi
        .spyOn(Date, "now")
        .mockReturnValue(Date.now() + 61 * 60_000);
      try {
        await run();
      } finally {
        clock.mockRestore();
      }
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(await judgements()).toEqual([]);
      await expectStatus(await api.approve(topicId, incomingId), 200);
    },
  );

  it.each([
    ["text that is not JSON", "maybe"],
    ["JSON without a boolean", JSON.stringify({ contradicts: "yes" })],
  ])(
    "keeps %s as an open question and does not ask again",
    async (_n, text) => {
      fetchMock.mockImplementation(async () => reply(text));
      const { api, topicId, incomingId } = await scene();
      await run();
      await run();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const rows = await judgements();
      expect(rows).toHaveLength(1);
      expect(rows[0].contradicts).toBeNull();
      expect((await api.receipt(incomingId)).unjudged).toHaveLength(1);
      await expectStatus(await api.approve(topicId, incomingId), 200);
    },
  );

  it("asks at most five questions a day", async () => {
    await scene({ terms: 6 });
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(await judgements()).toHaveLength(5);

    await run();
    expect(fetchMock).toHaveBeenCalledTimes(5);

    await db
      .update(statementJudgementTable)
      .set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("counts the five questions a day for each workspace", async () => {
    await scene({ terms: 6 });
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(5);

    // The same wordings in another workspace reuse the five answers; the
    // sixth is asked there, though the first workspace has had its five.
    const other = await scene({ terms: 6 });
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(
      (await judgements()).filter((row) => row.workspaceId === other.world.ws),
    ).toHaveLength(1);
  });

  it("asks nothing for a slot that is not a term or a draft off any topic", async () => {
    const { api, topicId, currentId, incomingId } = await scene();
    await api.addSlot(topicId, { name: "Price", type: "number" });
    for (const [id, amount] of [
      [currentId, 900],
      [incomingId, 950],
    ] as const) {
      const statement = await api.add(id, {
        slot: "price",
        value: String(amount),
        quote: "900 USD",
      });
      if (id === currentId) {
        await expectStatus(await api.decide(id, statement.id, "confirm"), 200);
      }
    }
    await api.write("Scratch", textOf(NAMES.slice(0, 1), "Kestrel"));

    await run();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(body().messages)).not.toContain("Price");
    const receipt = await api.receipt(incomingId);
    expect(receipt.conflicts.map((c) => c.slot).sort()).toEqual([
      "codename",
      "price",
    ]);
  });

  it("does not send a pair the document's author cannot open", async () => {
    const { world, currentId } = await scene({ author: "limited" });
    await db
      .update(documentTable)
      .set({ projectId: world.beta.id })
      .where(eq(documentTable.id, currentId));

    await run();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await judgements()).toEqual([]);

    // The same pair is asked about once its author can open both documents.
    await db
      .update(documentTable)
      .set({ projectId: world.alpha.id })
      .where(eq(documentTable.id, currentId));
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tells a decider who can open the current document", async () => {
    const { incomingId, decider } = await scene({ decider: "limited" });
    await run();
    const rows = await questions(decider.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].resourceId).toBe(incomingId);
  });

  it("does not tell a decider who cannot open the current document", async () => {
    const { world, currentId, decider } = await scene({ decider: "limited" });
    await db
      .update(documentTable)
      .set({ projectId: world.beta.id })
      .where(eq(documentTable.id, currentId));

    await run();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const rows = await judgements();
    expect(rows).toHaveLength(1);
    expect(rows[0].contradicts).toBe(true);
    expect(await questions(decider.id)).toEqual([]);
  });
});
