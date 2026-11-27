import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { eq, sql } from "drizzle-orm";
import db from "../../apps/api/src/database";
import {
  aiUsageTable,
  documentExtractionTable,
  statementTable,
} from "../../apps/api/src/database/schema";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import {
  filing,
  HOW_MUCH,
  LAUNCH,
  PRICE,
  type Said,
  setup,
  type Slot,
  type Statement,
  TEXT,
  WHEN,
} from "./helpers/statement-filing";

describe("API integration: topic slots", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("adds a slot with a key from its name, lists it and removes it", async () => {
    const world = await buildDocumentWorld();
    const api = filing(world);
    const topicId = await api.topic();

    const slot = await api.addSlot(topicId, {
      name: "Launch date",
      type: "date",
    });
    expect(slot).toMatchObject({ key: "launch_date", name: "Launch date" });
    const custom = await api.addSlot(topicId, {
      name: "Seats",
      type: "number",
      key: "seat_count",
    });
    expect(custom.key).toBe("seat_count");

    const listed = (await (
      await api.slotsOf(world.limited, topicId)
    ).json()) as Slot[];
    expect(listed.map((s) => s.key).sort()).toEqual([
      "launch_date",
      "seat_count",
    ]);

    const removed = await world.as(world.owner)(
      `/topic/workspace/${world.ws}/${topicId}/slots/${slot.id}`,
      json("DELETE"),
    );
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ id: slot.id });
    const after = (await (
      await api.slotsOf(world.owner, topicId)
    ).json()) as Slot[];
    expect(after.map((s) => s.key)).toEqual(["seat_count"]);
  });

  it("refuses a taken key and an enum with fewer than two options", async () => {
    const world = await buildDocumentWorld();
    const api = filing(world);
    const topicId = await api.topic();
    await api.addSlot(topicId, { name: "Launch date", type: "date" });

    const taken = await api.postSlot(world.owner, topicId, {
      name: "Launch date",
      type: "date",
    });
    expect(taken.status).toBe(409);
    const thin = await api.postSlot(world.owner, topicId, {
      name: "Phase",
      type: "enum",
      options: ["alpha"],
    });
    expect(thin.status).toBe(400);
    const enough = await api.postSlot(world.owner, topicId, {
      name: "Phase",
      type: "enum",
      options: ["alpha", "beta"],
    });
    expect(enough.status).toBe(200);
  });

  it("lets only the decider or a workspace owner change the slots", async () => {
    const world = await buildDocumentWorld();
    const api = filing(world);
    const topicId = await api.topic();
    const slot = await api.addSlot(topicId, { name: "Price", type: "number" });

    const add = await api.postSlot(world.open, topicId, {
      name: "Seats",
      type: "number",
    });
    expect(add.status).toBe(403);
    const remove = await world.as(world.open)(
      `/topic/workspace/${world.ws}/${topicId}/slots/${slot.id}`,
      json("DELETE"),
    );
    expect(remove.status).toBe(403);
    expect(
      ((await (await api.slotsOf(world.owner, topicId)).json()) as Slot[])
        .length,
    ).toBe(1);
  });
});

describe("API integration: statements of a document", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("records a person's statement as proposed with the quote's position", async () => {
    const { api, docId } = await setup();

    const statement = await api.add(docId, WHEN);
    expect(statement).toMatchObject({
      slot: "launch_date",
      value: "2027-03-05",
      quote: "5 March 2027",
      quoteStart: 13,
      status: "proposed",
      source: "person",
    });
    expect(await api.statementsOf(docId)).toHaveLength(1);
  });

  it("refuses a document that is not filed on a topic", async () => {
    const { api } = await setup();
    const draft = await api.write("Scratch", TEXT);
    expect((await api.post(draft, WHEN)).status).toBe(409);
  });

  it("names the topic's slot keys when the slot is unknown", async () => {
    const { api, docId } = await setup();
    const response = await api.post(docId, { ...WHEN, slot: "no_such" });
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain("launch_date");
    expect(body).toContain("price");
  });

  it("accepts only a verbatim quote, whatever the spacing", async () => {
    const { api, docId } = await setup();
    const made = async (quote: string) =>
      (await api.post(docId, { ...HOW_MUCH, quote })).status;
    expect(await made("40 EUR")).toBe(400);
    expect(await made("the price is 40 USD")).toBe(400);
    expect(await made("The price is\n40   USD per  seat.")).toBe(200);
  });

  it("refuses a value the slot cannot hold", async () => {
    const { api, topicId, docId } = await setup();
    await api.addSlot(topicId, {
      name: "Phase",
      type: "enum",
      options: ["alpha", "beta"],
    });
    await api.addSlot(topicId, { name: "Signed", type: "bool" });
    const quote = "We launch";
    expect(
      (await api.post(docId, { slot: "phase", value: "gamma", quote })).status,
    ).toBe(400);
    expect(
      (await api.post(docId, { slot: "phase", value: "beta", quote })).status,
    ).toBe(200);
    expect(
      (await api.post(docId, { slot: "signed", value: "maybe", quote })).status,
    ).toBe(400);
  });

  it("replaces a proposed statement and refuses to replace a confirmed one", async () => {
    const { api, docId } = await setup();
    const first = await api.add(docId, HOW_MUCH);
    const second = await api.add(docId, { ...HOW_MUCH, value: "45" });
    expect(second.id).toBe(first.id);
    expect(second.value).toBe("45");
    expect(await api.statementsOf(docId)).toHaveLength(1);

    expect((await api.decide(docId, first.id, "confirm")).status).toBe(200);
    expect((await api.post(docId, HOW_MUCH)).status).toBe(409);
  });

  it("refuses a short quote, which would be found almost anywhere", async () => {
    const { api, docId } = await setup();
    expect((await api.post(docId, { ...WHEN, quote: "5" })).status).toBe(400);
    expect((await api.post(docId, { ...WHEN, quote: " 27. " })).status).toBe(
      400,
    );
    expect(await api.statementsOf(docId)).toEqual([]);
  });

  it("keeps a statement that was confirmed meanwhile when a person writes another", async () => {
    const { api, docId } = await setup();
    const first = await api.add(docId, HOW_MUCH);
    let sending: Promise<Response> | undefined;
    await db.transaction(async (tx) => {
      await tx
        .select({ id: statementTable.id })
        .from(statementTable)
        .where(eq(statementTable.id, first.id))
        .for("update");
      sending = api.post(docId, { ...HOW_MUCH, value: "45" });
      // The request has read the proposal and now waits to write the row.
      await vi.waitFor(async () => {
        const waiting = await db.execute(
          sql`select 1 from pg_locks where not granted`,
        );
        expect(waiting.rows).toHaveLength(1);
      });
      await tx
        .update(statementTable)
        .set({ status: "confirmed" })
        .where(eq(statementTable.id, first.id));
    });

    expect((await sending)?.status).toBe(409);
    expect(await api.statementsOf(docId)).toMatchObject([
      { id: first.id, value: "40", status: "confirmed" },
    ]);
  });

  it("answers 403 to a member who can only view the document", async () => {
    const { api, world, docId } = await setup();
    // Everyone who can open the document's place may edit it until its owner
    // says otherwise.
    const narrowed = await world.as(world.owner)(
      `/document/workspace/${world.ws}/${docId}`,
      json("PATCH", { generalAccess: "view" }),
    );
    expect(narrowed.status).toBe(200);
    expect((await api.statementsOf(docId, world.open)).length).toBe(0);
    expect((await api.post(docId, WHEN, world.open)).status).toBe(403);
  });

  it("answers 403 when an editor adds on current document, unless they decide on its topic", async () => {
    const { api, world, topicId, docId } = await setup();
    const proposal = await api.add(docId, HOW_MUCH);
    expect((await api.approve(topicId, docId)).status).toBe(200);

    // On the current document a statement says what the topic states, so an
    // editor who does not decide on the topic neither adds nor replaces one.
    expect((await api.post(docId, WHEN, world.open)).status).toBe(403);
    expect(
      (await api.post(docId, { ...HOW_MUCH, value: "45" }, world.open)).status,
    ).toBe(403);
    expect(await api.statementsOf(docId)).toMatchObject([
      { id: proposal.id, value: "40", status: "proposed" },
    ]);

    // The topic's backup decides on it, so they may.
    const named = await world.as(world.owner)(
      `/topic/workspace/${world.ws}/${topicId}`,
      json("PATCH", { backupDeciderId: world.open.id }),
    );
    expect(named.status).toBe(200);
    expect((await api.post(docId, WHEN, world.open)).status).toBe(200);
    // So may the workspace owner.
    expect((await api.post(docId, { ...HOW_MUCH, value: "45" })).status).toBe(
      200,
    );
  });

  it("lets an editor who does not decide add a statement to a proposal", async () => {
    const { api, world, docId } = await setup();
    expect((await api.post(docId, WHEN, world.open)).status).toBe(200);
  });

  it("confirms a statement, twice without harm, and not one of another document", async () => {
    const { api, docId, topicId } = await setup();
    const statement = await api.add(docId, WHEN);
    const confirmed = await api.decide(docId, statement.id, "confirm");
    expect(confirmed.status).toBe(200);
    const body = (await confirmed.json()) as Statement;
    expect(body.status).toBe("confirmed");
    expect(body.decidedByName).toBeTruthy();
    expect((await api.decide(docId, statement.id, "confirm")).status).toBe(200);

    const other = await api.filed(topicId, "Other", `<p>${LAUNCH}</p>`);
    expect((await api.decide(other, statement.id, "confirm")).status).toBe(404);
  });

  it("leaves a statement behind when its document moves to another topic", async () => {
    const { api, topicId, docId } = await setup();
    const { id } = await api.add(docId, WHEN);
    const other = await api.topic("Pricing");
    await api.file(other, docId);

    // The slot belongs to the first topic. On the second one the document
    // states nothing, and the first topic's slot is not named there.
    expect(await api.statementsOf(docId)).toEqual([]);
    expect((await api.decide(docId, id, "confirm")).status).toBe(404);
    const rejected = await api.decide(docId, id, "reject", { reason: "No." });
    expect(rejected.status).toBe(404);

    await api.file(topicId, docId);
    expect(await api.statementsOf(docId)).toMatchObject([
      { id, status: "proposed" },
    ]);
  });

  it("rejects with a reason, blocks a later confirm and accepts a new statement", async () => {
    const { api, docId } = await setup();
    const statement = await api.add(docId, WHEN);
    expect((await api.decide(docId, statement.id, "reject", {})).status).toBe(
      400,
    );
    const rejected = await api.decide(docId, statement.id, "reject", {
      reason: "That is the old date",
    });
    expect(rejected.status).toBe(200);
    expect(await rejected.json()).toMatchObject({
      status: "rejected",
      statusReason: "That is the old date",
    });
    expect((await api.decide(docId, statement.id, "confirm")).status).toBe(409);

    const again = await api.add(docId, WHEN);
    expect(again.id).not.toBe(statement.id);
    const listed = await api.statementsOf(docId);
    expect(listed.map((s) => s.status).sort()).toEqual([
      "proposed",
      "rejected",
    ]);
  });
});

describe("API integration: statements and edits", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("proposes a new statement after an edit, even when the old one was confirmed", async () => {
    const { api, docId } = await setup();
    const old = await api.add(docId, WHEN);
    await api.decide(docId, old.id, "confirm");

    await api.edit(docId, `<p>${LAUNCH} Doors open at nine.</p>`);
    const [now, ...rest] = await api.statementsOf(docId);
    expect(rest).toEqual([]);
    expect(now.slot).toBe("launch_date");
    expect(now.id).not.toBe(old.id);
    expect(now.status).toBe("proposed");
  });

  it("does not carry a confirmation over to an edit that negates the fact", async () => {
    const { api, docId } = await setup();
    const old = await api.add(docId, WHEN);
    await api.decide(docId, old.id, "confirm");

    await api.edit(docId, "<p>We launch on 5 March 2027 was the old plan.</p>");
    const listed = await api.statementsOf(docId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ status: "proposed" });
    expect(listed[0].id).not.toBe(old.id);
  });

  it("keeps a confirmation when the edit leaves the statement's paragraph as it was", async () => {
    const { api, docId } = await setup();
    for (const said of [WHEN, HOW_MUCH]) {
      const { id } = await api.add(docId, said);
      await api.decide(docId, id, "confirm");
    }

    await api.edit(docId, `<p>${LAUNCH}</p><p>${PRICE} Children pay half.</p>`);
    const listed = await api.statementsOf(docId);
    expect(listed.map((s) => [s.slot, s.status, s.decidedAt !== null])).toEqual(
      [
        ["launch_date", "confirmed", true],
        ["price", "proposed", false],
      ],
    );
  });

  it("lists nothing for a slot whose quote is gone", async () => {
    const { api, docId } = await setup();
    await api.add(docId, WHEN);
    await api.add(docId, HOW_MUCH);

    await api.edit(docId, `<p>We launch soon.</p><p>${PRICE}</p>`);
    expect((await api.statementsOf(docId)).map((s) => s.slot)).toEqual([
      "price",
    ]);
  });

  it("does not carry a rejected statement to the new text", async () => {
    const { api, docId } = await setup();
    const statement = await api.add(docId, WHEN);
    await api.decide(docId, statement.id, "reject", { reason: "Wrong" });

    await api.edit(docId, `<p>${LAUNCH} Doors open at nine.</p>`);
    expect(await api.statementsOf(docId)).toEqual([]);
  });

  it("lists the earlier confirmed statement again after editing back", async () => {
    const { api, docId } = await setup();
    const old = await api.add(docId, WHEN);
    await api.decide(docId, old.id, "confirm");

    await api.edit(docId, `<p>${LAUNCH} Doors open at nine.</p>`);
    await api.edit(docId, TEXT);
    const listed = await api.statementsOf(docId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: old.id, status: "confirmed" });
  });
});

describe("API integration: statements in the chat save flow", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const MARKDOWN = `${LAUNCH}\n\n${PRICE}`;

  it("shows a topic's slots when a draft is saved and when topics are read", async () => {
    const world = await buildDocumentWorld();
    const api = filing(world);
    const topicId = await api.topic();
    await api.addSlot(topicId, { name: "Launch date", type: "date" });
    await api.addSlot(topicId, {
      name: "Phase",
      type: "enum",
      options: ["alpha", "beta"],
    });
    const expected = [
      { key: "launch_date", name: "Launch date", type: "date", options: null },
      { key: "phase", name: "Phase", type: "enum", options: ["alpha", "beta"] },
    ];
    const sortSlots = (slots: unknown[]) =>
      [...(slots as Slot[])]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map(({ key, name, type, options }) => ({ key, name, type, options }));

    const saved = await api.chatSave(MARKDOWN);
    const topic = saved.topics.find((t) => t.id === topicId);
    expect(sortSlots(topic?.slots ?? [])).toEqual(expected);

    const current = await world.as(world.owner)(
      `/topic/workspace/${world.ws}/current?topic=${encodeURIComponent("launch plan")}`,
    );
    const body = (await current.json()) as {
      topics: { id: string; slots: unknown[] }[];
    };
    expect(
      sortSlots(body.topics.find((t) => t.id === topicId)?.slots ?? []),
    ).toEqual(expected);
  });

  it("settles with statements, reports each result in order and never fails on a bad one", async () => {
    const world = await buildDocumentWorld();
    const api = filing(world);
    const topicId = await api.topic();
    await api.addSlot(topicId, { name: "Launch date", type: "date" });
    await api.addSlot(topicId, { name: "Price", type: "number" });
    await api.addSlot(topicId, {
      name: "Phase",
      type: "enum",
      options: ["alpha", "beta"],
    });
    const saved = await api.chatSave(MARKDOWN);

    const response = await api.settle(saved.id, {
      choice: "proposal",
      topicId,
      statements: [
        WHEN,
        { slot: "no_such", value: "x", quote: "We launch" },
        { ...HOW_MUCH, quote: "40 EUR" },
        { slot: "phase", value: "gamma", quote: "We launch" },
      ],
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      statements: { slot: string; result: string; id?: string }[];
    };
    expect(
      body.statements.map(({ slot, result }) => ({ slot, result })),
    ).toEqual([
      { slot: "launch_date", result: "added" },
      { slot: "no_such", result: "unknown_slot" },
      { slot: "price", result: "quote_not_found" },
      { slot: "phase", result: "invalid_value" },
    ]);

    const listed = await api.statementsOf(saved.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      id: body.statements[0].id,
      slot: "launch_date",
      source: "assistant",
      status: "proposed",
    });
  });
});

describe("API integration: statement extraction job", () => {
  const answer = (
    statements: Said[],
    tokens = { prompt: 120, completion: 30 },
  ) =>
    new Response(
      JSON.stringify({
        model: "test/model",
        choices: [{ message: { content: JSON.stringify({ statements }) } }],
        usage: {
          prompt_tokens: tokens.prompt,
          completion_tokens: tokens.completion,
          total_tokens: tokens.prompt + tokens.completion,
          cost: 0.0002,
        },
      }),
    );
  const raw = (content: string) =>
    new Response(
      JSON.stringify({
        model: "test/model",
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      }),
    );
  const job = () => import("../../apps/api/src/scheduler/statement-extraction");
  const run = async () => (await job()).extractFiledDocuments();
  const body = (fetchMock: ReturnType<typeof vi.fn>, call = 0) =>
    JSON.parse(
      (fetchMock.mock.calls[call] as unknown as [string, { body: string }])[1]
        .body,
    );
  const extractions = () => db.select().from(documentExtractionTable);
  const usageRows = () => db.select().from(aiUsageTable);
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await resetTestDatabase();
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    (await job()).extractionRetry.reset();
    fetchMock = vi.fn(async () => answer([WHEN, HOW_MUCH]));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does nothing without an API key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await setup();
    await run();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await extractions()).toEqual([]);
  });

  it("asks once, keeps only verbatim statements on known slots and records the cost", async () => {
    const { api, docId } = await setup();
    fetchMock.mockImplementation(async () =>
      answer([
        WHEN,
        { ...HOW_MUCH, quote: "99 USD" },
        { slot: "no_such", value: "x", quote: "We launch" },
      ]),
    );
    await run();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = body(fetchMock);
    expect(sent.stream).toBe(false);
    expect(sent.provider.zdr).toBe(true);
    expect(sent.provider.data_collection).toBe("deny");
    const prompt = sent.messages[1].content as string;
    for (const needle of ["launch_date", "price", LAUNCH, PRICE]) {
      expect(prompt).toContain(needle);
    }
    expect(prompt).not.toContain("<p>");

    const listed = await api.statementsOf(docId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      slot: "launch_date",
      value: "2027-03-05",
      source: "model",
      status: "proposed",
    });
    const usage = await usageRows();
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      purpose: "statements",
      promptTokens: 120,
      completionTokens: 30,
    });
    const rows = await extractions();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ documentId: docId, readable: true });
  });

  it("does not ask again about the same text and slots", async () => {
    await setup();
    await run();
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps an unreadable answer and does not ask again", async () => {
    const { api, docId } = await setup();
    fetchMock.mockImplementation(async () => raw("not json"));
    await run();
    await run();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await api.statementsOf(docId)).toEqual([]);
    const rows = await extractions();
    expect(rows).toHaveLength(1);
    expect(rows[0].readable).toBe(false);
  });

  it("keeps no row when the model fails, and asks again an hour later", async () => {
    await setup();
    fetchMock.mockImplementation(
      async () => new Response("boom", { status: 500 }),
    );
    await run();
    expect(await extractions()).toEqual([]);
    // Not on the next run: a provider that is down is not asked every minute.
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const later = Date.now() + 61 * 60_000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(later);
    await run();
    clock.mockRestore();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads a long document part by part and asks later parts only about the empty slots", async () => {
    const world = await buildDocumentWorld();
    const api = filing(world);
    const topicId = await api.topic();
    await api.addSlot(topicId, { name: "Launch date", type: "date" });
    await api.addSlot(topicId, { name: "Price", type: "number" });
    const filler = `<p>${"Nothing to report. ".repeat(700)}</p>`;
    const docId = await api.filed(
      topicId,
      "Long plan",
      `<p>${LAUNCH}</p>${filler}<p>${PRICE}</p>`,
    );
    fetchMock
      .mockImplementationOnce(async () => answer([WHEN]))
      .mockImplementationOnce(async () => answer([HOW_MUCH]));
    await run();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [first, second] = [0, 1].map(
      (call) => body(fetchMock, call).messages[1].content as string,
    );
    expect(first).toContain(LAUNCH);
    expect(first).not.toContain(PRICE);
    expect(second).toContain(PRICE);
    expect(second).not.toContain("launch_date");
    expect((await api.statementsOf(docId)).map((s) => s.slot)).toEqual([
      "launch_date",
      "price",
    ]);
    expect(await extractions()).toHaveLength(1);
  });

  it("stops at the daily token cap", async () => {
    vi.stubEnv("EXTRACTION_DAILY_TOKEN_CAP", "1000");
    await db.insert(aiUsageTable).values({
      purpose: "statements",
      model: "test/model",
      promptTokens: 1000,
      completionTokens: 0,
    });
    await setup();
    await run();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips a draft and a topic without slots", async () => {
    const world = await buildDocumentWorld();
    const api = filing(world);
    const withSlots = await api.topic("Launch plan");
    await api.addSlot(withSlots, { name: "Launch date", type: "date" });
    await api.write("Scratch", TEXT);
    const bare = await api.topic("Bare topic");
    await api.filed(bare);
    await run();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks again after the text is edited and after a slot is added", async () => {
    const { api, docId, topicId } = await setup();
    await run();
    await api.edit(docId, `<p>${LAUNCH} Doors open at nine.</p>`);
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await api.addSlot(topicId, { name: "Seats", type: "number" });
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not replace a statement a person wrote", async () => {
    const { api, docId } = await setup();
    await api.add(docId, { ...WHEN, value: "2027-03-06" });
    fetchMock.mockImplementation(async () => answer([WHEN]));
    await run();

    const listed = await api.statementsOf(docId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ source: "person", value: "2027-03-06" });
  });

  it("reads at most five documents a run", async () => {
    const world = await buildDocumentWorld();
    const api = filing(world);
    const topicId = await api.topic();
    await api.addSlot(topicId, { name: "Launch date", type: "date" });
    for (let i = 1; i <= 6; i++) {
      await api.filed(topicId, `Plan ${i}`, `<p>${LAUNCH} Version ${i}.</p>`);
    }
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
