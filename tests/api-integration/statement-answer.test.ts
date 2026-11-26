import { beforeEach, describe, expect, it } from "vite-plus/test";
import { resetTestDatabase } from "./helpers/database";
import { buildDocumentWorld } from "./helpers/document-access/build-document-world";
import { filing, type Answer } from "./helpers/statement-filing";

const CURRENT_TEXT =
  "<p>We launch on 5 March 2027.</p><p>The price is 40 USD per seat.</p><p>The codename is Falcon.</p>";
const INCOMING_TEXT =
  "<p>We launch on 5 March 2027.</p><p>The price is 45 USD per seat.</p>";
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
const CODENAME = { slot: "codename", value: "Falcon", quote: "Falcon" };

// A topic whose current document confirms the date and the price, and only
// proposes the codename.
async function setup() {
  const world = await buildDocumentWorld();
  const api = filing(world);
  const topicId = await api.topic();
  for (const [name, type] of [
    ["Launch date", "date"],
    ["Price", "number"],
    ["Codename", "term"],
    ["Owner", "person"],
  ]) {
    await api.addSlot(topicId, { name, type });
  }
  const currentId = await api.filed(topicId, "Launch plan", CURRENT_TEXT);
  for (const said of [DATE, price(40)]) {
    const statement = await api.add(currentId, said);
    await expectStatus(
      await api.decide(currentId, statement.id, "confirm"),
      200,
    );
  }
  await api.add(currentId, CODENAME);
  await expectStatus(await api.approve(topicId, currentId), 200);
  return { world, api, topicId, currentId };
}

async function expectStatus(response: Response, status: number) {
  expect(response.status, await response.clone().text()).toBe(status);
}

const empty = (slot: string, slotName: string, type: string): Answer => ({
  slot,
  slotName,
  type,
  statementId: null,
  value: null,
  quote: null,
  documentId: null,
  documentTitle: null,
  approvedByName: null,
  approvedAt: null,
  proposedIn: [],
});

describe("API integration: statement answers", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("answers each slot from the current document, with the quote, the document and the approver", async () => {
    const { world, api, topicId, currentId } = await setup();

    const answers = (await api.current(topicId)).topics[0].answers;

    expect(answers.map((a) => a.slot)).toEqual([
      "codename",
      "launch_date",
      "owner",
      "price",
    ]);
    const bySlot = (slot: string) => answers.find((a) => a.slot === slot);
    expect(bySlot("launch_date")).toMatchObject({
      slotName: "Launch date",
      type: "date",
      value: "2027-03-05",
      quote: "5 March 2027",
      documentId: currentId,
      documentTitle: "Launch plan",
      approvedByName: world.owner.name,
      proposedIn: [],
    });
    expect(
      Number.isNaN(Date.parse(bySlot("launch_date")?.approvedAt as string)),
    ).toBe(false);
    expect(bySlot("price")).toMatchObject({ value: "40", quote: "40 USD" });
    expect(bySlot("codename")).toEqual(empty("codename", "Codename", "term"));
    expect(bySlot("owner")).toEqual(empty("owner", "Owner", "person"));
  });

  it("narrows to one slot, and has no answer for a slot the topic does not keep", async () => {
    const { api, topicId } = await setup();

    const one = (await api.current(topicId, "price")).topics[0].answers;
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ slot: "price", value: "40" });

    const none = await api.current(topicId, "no_such_slot");
    expect(none.topics[0].answers).toEqual([]);
  });

  it("keeps answering from the approved text after the current document is edited", async () => {
    const { api, topicId, currentId } = await setup();
    await api.edit(currentId, CURRENT_TEXT.replace("40 USD", "50 USD"));
    const priceAnswer = async () =>
      (await api.current(topicId, "price")).topics[0].answers[0];

    expect(await priceAnswer()).toMatchObject({
      value: "40",
      quote: "40 USD",
      documentId: currentId,
    });

    await api.add(currentId, price(50));
    expect(await priceAnswer()).toMatchObject({
      value: "40",
      quote: "40 USD",
      documentId: currentId,
    });
  });

  it("lists the documents in review that state something for a slot, by title only", async () => {
    const { api, topicId } = await setup();
    const incomingId = await api.filed(
      topicId,
      "Launch plan v2",
      INCOMING_TEXT,
    );
    const statement = await api.add(incomingId, price(45));

    const answers = async () => (await api.current(topicId)).topics[0].answers;
    const priceOf = async () =>
      (await answers()).find((a) => a.slot === "price") as Answer;
    expect(await priceOf()).toMatchObject({ value: "40" });
    expect((await priceOf()).proposedIn).toEqual([
      { id: incomingId, title: "Launch plan v2" },
    ]);
    expect(
      (await answers()).find((a) => a.slot === "launch_date")?.proposedIn,
    ).toEqual([]);

    await expectStatus(
      await api.decide(incomingId, statement.id, "reject", { reason: "No." }),
      200,
    );
    expect((await priceOf()).proposedIn).toEqual([]);

    // A statement belongs to one text. Once the words are gone from the
    // document, it no longer says anything about the slot.
    await api.add(incomingId, DATE);
    const dateOf = async () =>
      (await answers()).find((a) => a.slot === "launch_date")?.proposedIn;
    expect(await dateOf()).toEqual([
      { id: incomingId, title: "Launch plan v2" },
    ]);
    await api.edit(incomingId, "<p>The price is 45 USD per seat.</p>");
    expect(await dateOf()).toEqual([]);
  });

  it("answers from the new current document once it replaces the old one, and only for what was confirmed", async () => {
    const { api, topicId } = await setup();
    const incomingId = await api.filed(
      topicId,
      "Launch plan v2",
      INCOMING_TEXT,
    );
    await api.add(incomingId, DATE);
    await api.add(incomingId, price(45));
    const id = (await api.receipt(incomingId)).conflicts[0].id;
    await expectStatus(
      await api.settleConflict(incomingId, id, {
        decision: "replace",
        reason: "The price went up.",
      }),
      200,
    );
    await expectStatus(await api.approve(topicId, incomingId), 200);

    const answers = (await api.current(topicId)).topics[0].answers;

    expect(answers.find((a) => a.slot === "price")).toMatchObject({
      value: "45",
      quote: "45 USD",
      documentId: incomingId,
      documentTitle: "Launch plan v2",
    });
    expect(answers.find((a) => a.slot === "launch_date")).toMatchObject({
      value: null,
      documentId: null,
    });
  });

  it("has no answers for a topic that keeps no slots", async () => {
    const { api } = await setup();
    const bare = await api.topic("Pricing");

    expect((await api.current(bare)).topics[0].answers).toEqual([]);
  });
});
