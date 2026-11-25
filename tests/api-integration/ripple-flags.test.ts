import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import { createWorkspaceMember } from "./helpers/fixtures";
import {
  filing,
  type Member,
  type Said,
  type Statement,
} from "./helpers/statement-filing";

type Dependency = {
  id: string;
  statementId: string;
  taskId: string | null;
  documentId: string | null;
  needsReview: boolean;
};
type Ref = {
  statementId: string;
  slot: string;
  slotName: string;
  value: string;
  quote: string;
  documentId: string;
  documentTitle: string;
};
type Item = {
  id: string;
  flaggedAt: string;
  task: { id: string; title: string } | null;
  document: { id: string; title: string } | null;
  dependsOn: Ref;
  cause: Ref;
};

const DATE: Said = {
  slot: "launch_date",
  value: "2027-03-05",
  quote: "5 March 2027",
};
const LATER: Said = {
  slot: "launch_date",
  value: "2027-04-09",
  quote: "9 April 2027",
};
const price = (amount: number): Said => ({
  slot: "price",
  value: String(amount),
  quote: `${amount} USD`,
});
const CODENAME: Said = { slot: "codename", value: "Falcon", quote: "Falcon" };

const textOf = (saids: Said[]) =>
  saids.map((s) => `<p>We state ${s.quote}.</p>`).join("");

async function expectStatus(response: Response, status: number) {
  expect(response.status, await response.clone().text()).toBe(status);
}

function routes(world: DocumentWorld) {
  const { ws, owner } = world;
  const asUser = (user: Member) => world.as(user);
  return {
    depend: (
      docId: string,
      statementId: string,
      body: Record<string, unknown>,
      user: Member = owner,
    ) =>
      asUser(user)(
        `/document/workspace/${ws}/${docId}/statements/${statementId}/dependents`,
        json("PUT", body),
      ),
    remove: (
      docId: string,
      statementId: string,
      dependencyId: string,
      user: Member = owner,
    ) =>
      asUser(user)(
        `/document/workspace/${ws}/${docId}/statements/${statementId}/dependents/${dependencyId}`,
        json("DELETE"),
      ),
    needsReview: async (user: Member = owner, workspaceId = ws) => {
      const response = await asUser(user)(
        `/topic/workspace/${workspaceId}/needs-review`,
      );
      await expectStatus(response, 200);
      return ((await response.json()) as { items: Item[] }).items;
    },
    clear: (id: string, user: Member = owner) =>
      asUser(user)(
        `/topic/workspace/${ws}/needs-review/${id}/clear`,
        json("POST"),
      ),
    setAside: (topicId: string, docId: string) =>
      asUser(owner)(
        `/topic/workspace/${ws}/${topicId}/document/${docId}/set-aside`,
        json("POST"),
      ),
  };
}

type Api = ReturnType<typeof filing>;

async function confirmAll(api: Api, docId: string, saids: Said[]) {
  const made: Statement[] = [];
  for (const said of saids) {
    const statement = await api.add(docId, said);
    await expectStatus(await api.decide(docId, statement.id, "confirm"), 200);
    made.push(statement);
  }
  return made;
}

async function replaceWith(
  api: Api,
  topicId: string,
  title: string,
  saids: Said[],
) {
  const id = await api.filed(topicId, title, textOf(saids));
  await confirmAll(api, id, saids);
  for (const conflict of (await api.receipt(id)).conflicts) {
    await expectStatus(
      await api.settleConflict(id, conflict.id, {
        decision: "replace",
        reason: "Changed.",
      }),
      200,
    );
  }
  await expectStatus(await api.approve(topicId, id), 200);
  return id;
}

async function setup() {
  const world = await buildDocumentWorld();
  const api = filing(world);
  const r = routes(world);
  const topicId = await api.topic();
  for (const [name, type] of [
    ["Launch date", "date"],
    ["Price", "number"],
    ["Codename", "term"],
  ]) {
    await api.addSlot(topicId, { name, type });
  }
  const docId = await api.filed(
    topicId,
    "Launch plan",
    textOf([DATE, price(40), CODENAME]),
  );
  const [date, cost] = await confirmAll(api, docId, [DATE, price(40)]);
  await expectStatus(await api.approve(topicId, docId), 200);
  return { world, api, r, topicId, docId, date, cost };
}

async function dependOnPrice(s: Awaited<ReturnType<typeof setup>>) {
  const { world, r, docId, cost } = s;
  await expectStatus(
    await r.depend(docId, cost.id, { taskId: world.alphaTask.id }),
    200,
  );
  const doc = await writeMemo(s, "Pricing memo");
  await expectStatus(await r.depend(docId, cost.id, { documentId: doc }), 200);
  return { doc };
}

const writeMemo = (s: Awaited<ReturnType<typeof setup>>, title: string) =>
  s.api.write(title, "<p>Memo.</p>");

describe("API integration: ripple flags", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("flags every dependency on a statement when another document replaces its value", async () => {
    const s = await setup();
    const { world, api, r, topicId, docId, cost } = s;
    const { doc } = await dependOnPrice(s);
    expect(await r.needsReview()).toEqual([]);

    await replaceWith(api, topicId, "Launch plan v2", [DATE, price(45)]);

    const items = await r.needsReview();
    expect(items).toHaveLength(2);
    const byTask = items.find((i) => i.task)!;
    const byDoc = items.find((i) => i.document)!;
    expect(byTask.task?.id).toBe(world.alphaTask.id);
    expect(byTask.document).toBeNull();
    expect(byDoc.document?.id).toBe(doc);
    expect(byTask.dependsOn).toMatchObject({
      statementId: cost.id,
      slot: "price",
      slotName: "Price",
      value: "40",
      quote: "40 USD",
      documentId: docId,
      documentTitle: "Launch plan",
    });
    expect(byTask.cause).toEqual(byTask.dependsOn);
    expect(byDoc.cause).toEqual(byDoc.dependsOn);
    expect(byTask.flaggedAt).toEqual(expect.any(String));
  });

  it("flags nothing when the new current document confirms the same value", async () => {
    const s = await setup();
    await dependOnPrice(s);

    await replaceWith(s.api, s.topicId, "Launch plan v2", [DATE, price(40)]);

    expect(await s.r.needsReview()).toEqual([]);
  });

  it("flags a dependency when the new current document states nothing for the slot", async () => {
    const s = await setup();
    await dependOnPrice(s);

    await replaceWith(s.api, s.topicId, "Launch plan v2", [DATE]);

    expect(await s.r.needsReview()).toHaveLength(2);
  });

  it("flags a dependency when the current document is set aside", async () => {
    const s = await setup();
    await dependOnPrice(s);

    await expectStatus(await s.r.setAside(s.topicId, s.docId), 200);

    expect(await s.r.needsReview()).toHaveLength(2);
  });

  it("carries a flag along a chain of dependencies and names the start as the cause", async () => {
    const s = await setup();
    const { world, api, r, topicId, docId, cost } = s;
    const other = await api.topic("Pricing");
    await api.addSlot(other, { name: "Codename", type: "term" });
    const d = await api.filed(other, "Pricing memo", textOf([CODENAME]));
    const [t] = await confirmAll(api, d, [CODENAME]);
    await expectStatus(await api.approve(other, d), 200);
    await expectStatus(await r.depend(docId, cost.id, { documentId: d }), 200);
    await expectStatus(
      await r.depend(d, t.id, { taskId: world.alphaTask.id }),
      200,
    );

    await replaceWith(api, topicId, "Launch plan v2", [DATE, price(45)]);

    const items = await r.needsReview();
    expect(items).toHaveLength(2);
    const viaDoc = items.find((i) => i.document)!;
    const viaTask = items.find((i) => i.task)!;
    expect(viaDoc.document?.id).toBe(d);
    expect(viaDoc.dependsOn.statementId).toBe(cost.id);
    expect(viaDoc.cause.statementId).toBe(cost.id);
    expect(viaTask.task?.id).toBe(world.alphaTask.id);
    expect(viaTask.dependsOn.statementId).toBe(t.id);
    expect(viaTask.cause.statementId).toBe(cost.id);
    expect(viaTask.cause.documentId).toBe(docId);
  });

  it("clears a flag, brings it back on the next change, and lists an uncleared flag once", async () => {
    const s = await setup();
    const { api, r, topicId, docId, cost, world } = s;
    await expectStatus(
      await r.depend(docId, cost.id, { taskId: world.alphaTask.id }),
      200,
    );
    await replaceWith(api, topicId, "Launch plan v2", [DATE, price(45)]);
    const [first] = await r.needsReview();

    await expectStatus(await r.clear("no-such-dependency"), 404);
    const cleared = await r.clear(first.id);
    await expectStatus(cleared, 200);
    expect(await cleared.json()).toEqual({ id: first.id, needsReview: false });
    expect(await r.needsReview()).toEqual([]);
    await expectStatus(await r.clear(first.id), 404);

    await replaceWith(api, topicId, "Launch plan v3", [DATE, price(50)]);
    const again = await r.needsReview();
    expect(again).toHaveLength(1);
    expect(again[0].id).toBe(first.id);

    // A flag nobody cleared keeps its time and its cause.
    await replaceWith(api, topicId, "Launch plan v4", [DATE, price(55)]);
    expect(await r.needsReview()).toEqual(again);
  });

  it("leaves a cleared flag alone when the topic states the old value again or another slot changes", async () => {
    const s = await setup();
    const { api, r, topicId, docId, cost, world } = s;
    await expectStatus(
      await r.depend(docId, cost.id, { taskId: world.alphaTask.id }),
      200,
    );
    await replaceWith(api, topicId, "Launch plan v2", [DATE, price(45)]);
    const [flag] = await r.needsReview();
    await expectStatus(await r.clear(flag.id), 200);

    // Only the date changes. The issue relies on the price.
    await replaceWith(api, topicId, "Launch plan v3", [LATER, price(45)]);
    expect(await r.needsReview()).toEqual([]);

    // The price is 40 again: the value the issue relies on.
    await replaceWith(api, topicId, "Launch plan v4", [LATER, price(40)]);
    expect(await r.needsReview()).toEqual([]);
  });

  it("lists a flag only in the workspace of its documents", async () => {
    const s = await setup();
    const { api, r, topicId, docId, cost, world } = s;
    await expectStatus(
      await r.depend(docId, cost.id, { taskId: world.alphaTask.id }),
      200,
    );
    await replaceWith(api, topicId, "Launch plan v2", [DATE, price(45)]);
    const [flag] = await r.needsReview();
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: world.owner.id,
      role: "owner",
      joinedAt: new Date(),
    });

    expect(await r.needsReview(world.owner, workspace.id)).toEqual([]);
    await expectStatus(
      await world.as(world.owner)(
        `/topic/workspace/${workspace.id}/needs-review/${flag.id}/clear`,
        json("POST"),
      ),
      404,
    );
    expect(await r.needsReview()).toHaveLength(1);
  });

  it("answers the refusals and the repeat of a dependency call", async () => {
    const s = await setup();
    const { world, api, r, topicId, docId, cost } = s;
    const taskBody = { taskId: world.alphaTask.id };

    await expectStatus(await r.depend(docId, cost.id, {}), 400);
    await expectStatus(
      await r.depend(docId, cost.id, { ...taskBody, documentId: docId }),
      400,
    );

    const first = await r.depend(docId, cost.id, taskBody);
    await expectStatus(first, 200);
    const made = (await first.json()) as Dependency;
    expect(made).toMatchObject({
      statementId: cost.id,
      taskId: world.alphaTask.id,
      documentId: null,
      needsReview: false,
    });
    const repeat = await r.depend(docId, cost.id, taskBody);
    await expectStatus(repeat, 200);
    expect(((await repeat.json()) as Dependency).id).toBe(made.id);

    const otherDoc = await api.write("Other", "<p>Other.</p>");
    await expectStatus(await r.depend(otherDoc, cost.id, taskBody), 404);
    await expectStatus(
      await r.depend(docId, "no-such-statement", taskBody),
      404,
    );
    await expectStatus(await r.depend(docId, cost.id, { taskId: "nope" }), 404);
    await expectStatus(
      await r.depend(docId, cost.id, { documentId: "nope" }),
      404,
    );

    const waiting = await api.filed(
      topicId,
      "Launch plan v2",
      textOf([price(45)]),
    );
    const [waits] = await confirmAll(api, waiting, [price(45)]);
    await expectStatus(await r.depend(waiting, waits.id, taskBody), 409);

    const proposed = await api.add(docId, CODENAME);
    await expectStatus(await r.depend(docId, proposed.id, taskBody), 409);
  });

  it("removes a dependency so a replacement flags nothing for it", async () => {
    const s = await setup();
    const { world, api, r, topicId, docId, cost } = s;
    const made = (await (
      await r.depend(docId, cost.id, { taskId: world.alphaTask.id })
    ).json()) as Dependency;

    await expectStatus(await r.remove(docId, cost.id, "no-such-id"), 404);
    const removed = await r.remove(docId, cost.id, made.id);
    await expectStatus(removed, 200);
    expect(await removed.json()).toEqual({ id: made.id });

    await replaceWith(api, topicId, "Launch plan v2", [DATE, price(45)]);
    expect(await r.needsReview()).toEqual([]);
  });

  it("flags only the dependents of the slot whose value changed", async () => {
    const s = await setup();
    const { world, api, r, topicId, docId, cost, date } = s;
    const dateTask = await r.depend(docId, date.id, {
      taskId: world.alphaTask.id,
    });
    await expectStatus(dateTask, 200);
    const priceDoc = await writeMemo(s, "Pricing memo");
    await expectStatus(
      await r.depend(docId, cost.id, { documentId: priceDoc }),
      200,
    );

    await replaceWith(api, topicId, "Launch plan v2", [DATE, price(45)]);

    const items = await r.needsReview();
    expect(items).toHaveLength(1);
    expect(items[0].document?.id).toBe(priceDoc);
    expect(items[0].dependsOn.slot).toBe("price");
  });

  it("refuses to delete a slot while work relies on one of its values", async () => {
    const s = await setup();
    const { world, r, topicId, docId, cost } = s;
    const made = await r.depend(docId, cost.id, {
      taskId: world.alphaTask.id,
    });
    await expectStatus(made, 200);
    const link = (await made.json()) as Dependency;
    const drop = () =>
      world.as(world.owner)(
        `/topic/workspace/${world.ws}/${topicId}/slots/${cost.slotId}`,
        json("DELETE"),
      );

    // The statements go with the slot, and the links would go with them.
    await expectStatus(await drop(), 409);
    const again = await r.depend(docId, cost.id, {
      taskId: world.alphaTask.id,
    });
    expect(((await again.json()) as Dependency).id).toBe(link.id);

    await expectStatus(await r.remove(docId, cost.id, link.id), 200);
    await expectStatus(await drop(), 200);
  });
});
