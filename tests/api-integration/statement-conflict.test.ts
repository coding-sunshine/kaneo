import { beforeEach, describe, expect, it } from "vite-plus/test";
import db from "../../apps/api/src/database";
import { statementConflictTable } from "../../apps/api/src/database/schema";
import { resetTestDatabase } from "./helpers/database";
import { buildDocumentWorld } from "./helpers/document-access/build-document-world";
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
});
