import { and, eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db from "../../apps/api/src/database";
import {
  notificationTable,
  statementConflictTable,
  taskTable,
  taskTopicTable,
} from "../../apps/api/src/database/schema";
import { mockAnonymousSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";
import { filing } from "./helpers/statement-filing";

const CURRENT_TEXT =
  "<p>We launch on 5 March 2027.</p><p>The price is 40 USD per seat.</p><p>The codename is Falcon.</p>";
const INCOMING_TEXT =
  "<p>We launch on 5 March 2027.</p><p>The price is 45 USD per seat.</p><p>The codename is Kestrel.</p><p>Priya owns the launch.</p>";
const DATE = {
  slot: "launch_date",
  value: "2027-03-05",
  quote: "5 March 2027",
};
const price = (amount: number) => ({
  slot: "price",
  value: String(amount),
  quote: `${amount} USD`,
});
const codename = (name: string) => ({
  slot: "codename",
  value: name,
  quote: name,
});
const OWNER = { slot: "owner", value: "Priya", quote: "Priya" };
const IN_A_WEEK = () =>
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

// A topic whose current document is confirmed, and an incoming document with
// proposed statements that differ on price and codename.
async function setup() {
  const world = await buildDocumentWorld();
  const api = filing(world);
  const topicId = await api.topic();
  for (const [name, type] of [
    ["Launch date", "date"],
    ["Price", "number"],
    ["Codename", "term"],
    ["Owner", "person"],
    ["Region", "term"],
  ]) {
    await api.addSlot(topicId, { name, type });
  }
  const currentId = await api.filed(topicId, "Launch plan", CURRENT_TEXT);
  for (const said of [DATE, price(40), codename("Falcon")]) {
    const statement = await api.add(currentId, said);
    const confirmed = await api.decide(currentId, statement.id, "confirm");
    expect(confirmed.status, await confirmed.clone().text()).toBe(200);
  }
  const approved = await api.approve(topicId, currentId);
  expect(approved.status, await approved.clone().text()).toBe(200);

  const incomingId = await api.filed(topicId, "Launch plan v2", INCOMING_TEXT);
  await api.add(incomingId, DATE);
  const priceStatement = await api.add(incomingId, price(45));
  await api.add(incomingId, codename("Kestrel"));
  await api.add(incomingId, OWNER);
  return { world, api, topicId, currentId, incomingId, priceStatement };
}

async function expectStatus(response: Response, status: number) {
  expect(response.status, await response.clone().text()).toBe(status);
}

describe("API integration: statement conflicts", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("sorts what an incoming document states into repeats, new, conflicts, unjudged and not checked", async () => {
    const { api, currentId, incomingId } = await setup();

    const receipt = await api.receipt(incomingId);

    expect(receipt.repeats).toHaveLength(1);
    expect(receipt.repeats[0]).toMatchObject({
      slot: "launch_date",
      value: "2027-03-05",
      quote: "5 March 2027",
      confirmed: false,
      current: {
        documentId: currentId,
        documentTitle: "Launch plan",
        value: "2027-03-05",
        quote: "5 March 2027",
      },
    });
    expect(receipt.new).toHaveLength(1);
    expect(receipt.new[0]).toMatchObject({ slot: "owner" });
    expect(receipt.conflicts).toHaveLength(1);
    expect(receipt.conflicts[0]).toMatchObject({
      slot: "price",
      slotName: "Price",
      value: "45",
      quote: "45 USD",
      confirmed: false,
      status: "open",
      reason: null,
      tolerateUntil: null,
      current: { documentId: currentId, value: "40", quote: "40 USD" },
    });
    expect(receipt.conflicts[0].id).toEqual(expect.any(String));
    expect(receipt.conflicts[0].id).not.toBe("");
    expect(receipt.unjudged).toHaveLength(1);
    expect(receipt.unjudged[0]).toMatchObject({
      slot: "codename",
      current: { value: "Falcon" },
    });
    expect(receipt.notChecked).toEqual([
      { slot: "region", slotName: "Region", type: "term" },
    ]);
  });

  it("refuses to make a document current while a conflict is open, also after an edit", async () => {
    const { api, topicId, incomingId, priceStatement } = await setup();
    await expectStatus(await api.approve(topicId, incomingId), 409);
    const id = (await api.receipt(incomingId)).conflicts[0].id;

    await expectStatus(
      await api.decide(incomingId, priceStatement.id, "confirm"),
      200,
    );
    await api.edit(
      incomingId,
      INCOMING_TEXT.replace("per seat", "per seat a month"),
    );

    const edited = await api.receipt(incomingId);
    expect(edited.conflicts).toHaveLength(1);
    // A confirmation is for the paragraph it was read in, so an edit there
    // drops it; the conflict stays.
    expect(edited.conflicts[0]).toMatchObject({
      id,
      status: "open",
      confirmed: false,
    });
    await expectStatus(await api.approve(topicId, incomingId), 409);

    const settled = await api.settleConflict(incomingId, id, {
      decision: "replace",
      reason: "The price went up.",
    });
    await expectStatus(settled, 200);
    expect(await settled.json()).toMatchObject({
      id,
      status: "resolved",
      reason: "The price went up.",
    });
    const after = await api.receipt(incomingId);
    expect(after.conflicts).toHaveLength(1);
    expect(after.conflicts[0]).toMatchObject({
      id,
      status: "resolved",
      confirmed: true,
    });
    await expectStatus(await api.approve(topicId, incomingId), 200);
    expect((await api.receipt(incomingId)).conflicts).toEqual([]);
  });

  it("keeps the current value by rejecting the incoming statement", async () => {
    const { api, topicId, incomingId } = await setup();
    const id = (await api.receipt(incomingId)).conflicts[0].id;

    const kept = await api.settleConflict(incomingId, id, {
      decision: "keep",
      reason: "Still 40.",
    });
    await expectStatus(kept, 200);
    expect(await kept.json()).toMatchObject({ status: "resolved" });

    const rows = await api.statementsOf(incomingId);
    const priced = rows.filter((s) => s.slot === "price");
    expect(priced).toHaveLength(1);
    expect(priced[0]).toMatchObject({
      status: "rejected",
      statusReason: "Still 40.",
    });
    const receipt = await api.receipt(incomingId);
    expect(receipt.conflicts).toEqual([]);
    expect(receipt.notChecked.map((n) => n.slot)).toContain("price");

    await api.add(incomingId, price(45));
    const again = await api.receipt(incomingId);
    expect(again.conflicts).toHaveLength(1);
    expect(again.conflicts[0]).toMatchObject({ id, status: "open" });
    await expectStatus(await api.approve(topicId, incomingId), 409);
  });

  it("tolerates a conflict until a date", async () => {
    const { api, topicId, incomingId } = await setup();
    const id = (await api.receipt(incomingId)).conflicts[0].id;
    const tolerate = (extra: Record<string, unknown>) =>
      api.settleConflict(incomingId, id, {
        decision: "tolerate",
        reason: "Until the review.",
        ...extra,
      });

    await expectStatus(await tolerate({}), 400);
    await expectStatus(
      await tolerate({
        tolerateUntil: new Date(Date.now() - 1000).toISOString(),
      }),
      400,
    );
    const tolerated = await tolerate({ tolerateUntil: IN_A_WEEK() });
    await expectStatus(tolerated, 200);
    const body = await tolerated.json();
    expect(body).toMatchObject({ status: "tolerated" });
    expect(body.tolerateUntil).not.toBeNull();
    expect((await api.receipt(incomingId)).conflicts[0]).toMatchObject({
      id,
      status: "tolerated",
    });

    // Let the tolerance run out.
    await db
      .update(statementConflictTable)
      .set({ tolerateUntil: new Date(Date.now() - 1000) });
    expect((await api.receipt(incomingId)).conflicts[0]).toMatchObject({
      id,
      status: "open",
    });
    await expectStatus(await api.approve(topicId, incomingId), 409);

    await expectStatus(await tolerate({ tolerateUntil: IN_A_WEEK() }), 200);
    await expectStatus(await api.approve(topicId, incomingId), 200);
  });

  it("lets only the topic's decider decide, and only on a pair that still stands", async () => {
    const { world, api, topicId, incomingId } = await setup();
    const id = (await api.receipt(incomingId)).conflicts[0].id;
    const replace = { decision: "replace", reason: "The price went up." };

    await expectStatus(
      await api.settleConflict(incomingId, id, replace, world.open),
      403,
    );
    await expectStatus(
      await api.settleConflict(incomingId, "no-such-conflict", replace),
      404,
    );
    await expectStatus(await api.settleConflict(incomingId, id, replace), 200);

    await api.edit(incomingId, INCOMING_TEXT.replace("45 USD", "46 USD"));
    await api.add(incomingId, price(46));
    const receipt = await api.receipt(incomingId);
    expect(receipt.conflicts).toHaveLength(1);
    expect(receipt.conflicts[0].id).not.toBe(id);
    expect(receipt.conflicts[0].status).toBe("open");
    await expectStatus(await api.settleConflict(incomingId, id, replace), 404);
    await expectStatus(await api.approve(topicId, incomingId), 409);
  });

  it("finds the conflict again when a document comes back to the topic", async () => {
    const world = await buildDocumentWorld();
    const api = filing(world);
    const topicId = await api.topic();
    await api.addSlot(topicId, { name: "Price", type: "number" });
    const a = await api.filed(
      topicId,
      "Plan A",
      "<p>The price is 40 USD per seat.</p>",
    );
    const aStatement = await api.add(a, price(40));
    const b = await api.filed(
      topicId,
      "Plan B",
      "<p>The price is 45 USD per seat.</p>",
    );
    await api.add(b, price(45));
    expect((await api.receipt(b)).conflicts).toEqual([]);

    const other = await api.topic("Pricing");
    await api.file(other, b);
    await expectStatus(await api.decide(a, aStatement.id, "confirm"), 200);
    await expectStatus(await api.approve(topicId, a), 200);

    await api.file(topicId, b);
    const receipt = await api.receipt(b);
    expect(receipt.conflicts).toHaveLength(1);
    expect(receipt.conflicts[0]).toMatchObject({
      status: "open",
      current: { documentId: a },
    });
    await expectStatus(await api.approve(topicId, b), 409);
  });

  it("holds an edited current document to its own approved text", async () => {
    const { api, topicId, currentId } = await setup();
    await api.edit(currentId, CURRENT_TEXT.replace("40 USD", "50 USD"));
    await api.add(currentId, price(50));

    const receipt = await api.receipt(currentId);
    expect(receipt.conflicts).toHaveLength(1);
    expect(receipt.conflicts[0]).toMatchObject({
      slot: "price",
      value: "50",
      current: { documentId: currentId, value: "40" },
    });
    await expectStatus(await api.approve(topicId, currentId), 409);
    await expectStatus(
      await api.settleConflict(currentId, receipt.conflicts[0].id, {
        decision: "replace",
        reason: "The price went up.",
      }),
      200,
    );
    await expectStatus(await api.approve(topicId, currentId), 200);
    expect((await api.receipt(currentId)).conflicts).toEqual([]);
  });

  it("does not hold back a document for a term that is worded differently", async () => {
    const { api, topicId } = await setup();
    const id = await api.filed(
      topicId,
      "Launch plan v3",
      "<p>The codename is Kestrel.</p>",
    );
    await api.add(id, codename("Kestrel"));

    const receipt = await api.receipt(id);
    expect(receipt.conflicts).toEqual([]);
    expect(receipt.unjudged).toHaveLength(1);
    await expectStatus(await api.approve(topicId, id), 200);
  });

  it("settles a pair as not a conflict and keeps the statement proposed", async () => {
    const { world, api, topicId, incomingId, priceStatement } = await setup();
    const id = (await api.receipt(incomingId)).conflicts[0].id;
    const dismiss = (user = world.owner) =>
      api.settleConflict(
        incomingId,
        id,
        { decision: "dismiss", reason: "Same thing in other words" },
        user,
      );
    await expectStatus(await api.approve(topicId, incomingId), 409);

    const settled = await dismiss();
    await expectStatus(settled, 200);
    expect(await settled.json()).toMatchObject({
      id,
      status: "resolved",
      reason: "Same thing in other words",
      tolerateUntil: null,
    });
    expect((await api.receipt(incomingId)).conflicts[0]).toMatchObject({
      id,
      status: "resolved",
    });
    const rows = await api.statementsOf(incomingId);
    expect(rows.find((r) => r.id === priceStatement.id)?.status).toBe(
      "proposed",
    );
    await expectStatus(await dismiss(world.open), 403);
    await expectStatus(await api.approve(topicId, incomingId), 200);
  });
});

describe("API integration: conflict question access", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("asks no question of a decider without topic access", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              model: "test/model",
              choices: [{ message: { content: '{"contradicts":true}' } }],
              usage: {
                prompt_tokens: 4,
                completion_tokens: 1,
                total_tokens: 5,
              },
            }),
          ),
      ),
    );
    await resetTestDatabase();
    const world = await buildDocumentWorld();
    const api = filing(world);
    const decider = await addWorkspaceMember(world.ws);
    const made = await world.as(world.owner)(
      "/topic",
      json("POST", {
        workspaceId: world.ws,
        name: "Launch plan",
        projectId: world.alpha.id,
        deciderId: decider.id,
      }),
    );
    await expectStatus(made, 200);
    const { id: topicId } = (await made.json()) as { id: string };
    await api.addSlot(topicId, { name: "Codename", type: "term" });
    const current = await api.filed(
      topicId,
      "Launch plan",
      "<p>The codename is Falcon.</p>",
    );
    const falcon = await api.add(current, codename("Falcon"));
    await expectStatus(await api.decide(current, falcon.id, "confirm"), 200);
    await expectStatus(await api.approve(topicId, current), 200);
    const incoming = await api.filed(
      topicId,
      "Launch plan v2",
      "<p>The codename is Kestrel.</p>",
    );
    await api.add(incoming, codename("Kestrel"));
    // The decider reads both documents by share, but cannot open the topic.
    for (const id of [current, incoming]) {
      await expectStatus(
        await world.as(world.owner)(
          `/document/workspace/${world.ws}/${id}/share/${decider.id}`,
          json("PUT", { access: "view" }),
        ),
        200,
      );
    }
    await restrictToProjects(world.ws, decider.id, [world.beta.id]);

    const scheduler =
      await import("../../apps/api/src/scheduler/conflict-questions");
    scheduler.conflictRetry.reset();
    await scheduler.askConflictQuestions();

    const asked = await db
      .select()
      .from(notificationTable)
      .where(
        and(
          eq(notificationTable.userId, decider.id),
          eq(notificationTable.type, "document_question"),
        ),
      );
    expect(asked).toEqual([]);
  });
});

type SuggestedTicket = {
  key: string;
  kind: "change" | "new";
  slot: string;
  slotName: string;
  value: string;
  previousValue: string | null;
  title: string;
  accepted: boolean;
  ticket: { id: string; number: number | null; projectId: string } | null;
};

describe("API integration: suggested tickets from a change receipt", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const suggestedTickets = async (
    api: ReturnType<typeof filing>,
    id: string,
    user?: Parameters<ReturnType<typeof filing>["receipt"]>[1],
  ) =>
    (
      (await api.receipt(id, user)) as unknown as {
        suggestedTickets: SuggestedTicket[];
      }
    ).suggestedTickets;
  const accept = (
    world: Awaited<ReturnType<typeof buildDocumentWorld>>,
    id: string,
    key: string,
    body: Record<string, unknown> = {},
    user = world.owner,
  ) =>
    world.as(user)(
      `/document/workspace/${world.ws}/${id}/receipt/tickets/${encodeURIComponent(key)}/accept`,
      json("POST", body),
    );
  const taskRow = async (id: string) =>
    (await db.select().from(taskTable).where(eq(taskTable.id, id)))[0];
  // Tickets made from suggestions: each one is on the topic.
  const taskCount = async () => (await db.select().from(taskTopicTable)).length;

  it("suggested tickets: the receipt suggests one per change, and a person accepts each one", async () => {
    const { world, api, topicId, incomingId } = await setup();

    const suggested = await suggestedTickets(api, incomingId);
    // The changed price and the new owner; a repeat and an unjudged
    // wording are no change to act on.
    expect(suggested.map((s) => [s.kind, s.slot])).toEqual([
      ["new", "owner"],
      ["change", "price"],
    ]);
    const price = suggested.find((s) => s.slot === "price")!;
    expect(price).toMatchObject({
      value: "45",
      previousValue: "40",
      accepted: false,
      ticket: null,
    });
    expect(price.title).toContain("Price");
    expect(price.title).toContain("45");

    const accepted = await accept(world, incomingId, price.key);
    await expectStatus(accepted, 200);
    const { taskId } = (await accepted.json()) as { taskId: string };
    const task = await taskRow(taskId);
    expect(task).toMatchObject({
      projectId: world.alpha.id,
      title: price.title,
    });
    expect(task?.description).toContain("45 USD");
    const onTopic = await db
      .select()
      .from(taskTopicTable)
      .where(eq(taskTopicTable.taskId, taskId));
    expect(onTopic.map((row) => row.topicId)).toEqual([topicId]);

    const after = await suggestedTickets(api, incomingId);
    expect(after.find((s) => s.slot === "price")).toMatchObject({
      accepted: true,
      ticket: { id: taskId, projectId: world.alpha.id },
    });
    expect(after.find((s) => s.slot === "owner")?.accepted).toBe(false);

    // Each suggestion is accepted once.
    await expectStatus(await accept(world, incomingId, price.key), 409);
    expect(await taskCount()).toBe(1);
    const owner = after.find((s) => s.slot === "owner")!;
    await expectStatus(await accept(world, incomingId, owner.key), 200);
    expect(await taskCount()).toBe(2);
  });

  it("suggested tickets stay accepted after an edit elsewhere in the text, and leave out a pair that is no conflict", async () => {
    const { world, api, incomingId } = await setup();
    const price = (await suggestedTickets(api, incomingId)).find(
      (s) => s.slot === "price",
    )!;
    await expectStatus(await accept(world, incomingId, price.key), 200);

    await api.edit(
      incomingId,
      INCOMING_TEXT.replace("Priya owns", "Priya leads and owns"),
    );
    const edited = await suggestedTickets(api, incomingId);
    expect(edited.find((s) => s.slot === "price")).toMatchObject({
      key: price.key,
      accepted: true,
    });

    const conflictId = (await api.receipt(incomingId)).conflicts[0].id;
    await expectStatus(
      await api.settleConflict(incomingId, conflictId, {
        decision: "dismiss",
        reason: "Same thing in other words",
      }),
      200,
    );
    expect(
      (await suggestedTickets(api, incomingId)).map((s) => s.slot),
    ).toEqual(["owner"]);
  });

  it("suggested tickets: who may see and accept them", async () => {
    const { world, api, incomingId } = await setup();
    const price = (await suggestedTickets(api, incomingId)).find(
      (s) => s.slot === "price",
    )!;

    // The topic lives in team Alpha; a member kept out of it sees nothing
    // and gets the answer an invented suggestion gets.
    const outsider = await addWorkspaceMember(world.ws);
    await restrictToProjects(world.ws, outsider.id, [world.beta.id]);
    await expectStatus(
      await world.as(world.owner)(
        `/document/workspace/${world.ws}/${incomingId}/share/${outsider.id}`,
        json("PUT", { access: "view" }),
      ),
      200,
    );
    expect(await suggestedTickets(api, incomingId, outsider)).toEqual([]);
    const hidden = await accept(world, incomingId, price.key, {}, outsider);
    const invented = await accept(
      world,
      incomingId,
      "no-such-key",
      {},
      outsider,
    );
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toEqual(await invented.json());
    await expectStatus(await accept(world, incomingId, "no-such-key"), 404);

    // An API key that can only read makes no ticket.
    const { key } = await auth.api.createApiKey({
      body: {
        userId: world.owner.id,
        name: "Receipt reader",
        permissions: { task: ["read"] },
      },
    });
    const asOwner = world.as(world.owner);
    mockAnonymousSession();
    const byKey = await asOwner(
      `/document/workspace/${world.ws}/${incomingId}/receipt/tickets/${price.key}/accept`,
      {
        ...json("POST", {}),
        headers: { "content-type": "application/json", "x-api-key": key },
      } as never,
    );
    expect(byKey.status).toBe(403);
    expect(await taskCount()).toBe(0);
  });

  it("suggested tickets of a workspace topic go to a team the person names, and hide a ticket in a team the reader cannot enter", async () => {
    const world = await buildDocumentWorld();
    const api = filing(world);
    const made = await world.as(world.owner)(
      "/topic",
      json("POST", { workspaceId: world.ws, name: "Pricing" }),
    );
    await expectStatus(made, 200);
    const { id: topicId } = (await made.json()) as { id: string };
    await api.addSlot(topicId, { name: "Price", type: "number" });
    const current = await api.filed(
      topicId,
      "Price list",
      "<p>The price is 40 USD per seat.</p>",
    );
    const forty = await api.add(current, price(40));
    await expectStatus(await api.decide(current, forty.id, "confirm"), 200);
    await expectStatus(await api.approve(topicId, current), 200);
    const incoming = await api.filed(
      topicId,
      "Price list v2",
      "<p>The price is 45 USD per seat.</p>",
    );
    await api.add(incoming, price(45));
    const [change] = await suggestedTickets(api, incoming);
    expect(change).toMatchObject({ kind: "change", slot: "price" });

    // No team of its own: the person says where the ticket goes.
    await expectStatus(await accept(world, incoming, change!.key), 400);
    const shut = await accept(
      world,
      incoming,
      change!.key,
      { projectId: world.beta.id },
      world.limited,
    );
    const nowhere = await accept(
      world,
      incoming,
      change!.key,
      { projectId: "no-such-team" },
      world.limited,
    );
    expect(shut.status).toBe(404);
    expect(await shut.json()).toEqual(await nowhere.json());
    expect(await taskCount()).toBe(0);

    const accepted = await accept(world, incoming, change!.key, {
      projectId: world.beta.id,
    });
    await expectStatus(accepted, 200);
    const { taskId } = (await accepted.json()) as { taskId: string };
    expect((await taskRow(taskId))?.projectId).toBe(world.beta.id);

    // `limited` cannot enter team Beta: the suggestion reads as taken, and
    // says nothing of the ticket.
    const seen = await suggestedTickets(api, incoming, world.limited);
    expect(seen).toEqual([
      expect.objectContaining({
        key: change!.key,
        accepted: true,
        ticket: null,
      }),
    ]);
  });
});
