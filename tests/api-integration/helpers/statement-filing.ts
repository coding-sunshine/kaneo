import { expect } from "vite-plus/test";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./document-access/build-document-world";

export type Member = DocumentWorld["owner"];
export type Slot = {
  id: string;
  key: string;
  name: string;
  type: string;
  options: string[] | null;
};
export type Statement = {
  id: string;
  slotId: string;
  slot: string;
  slotName: string;
  type: string;
  value: string;
  quote: string;
  quoteStart: number;
  status: string;
  statusReason: string | null;
  source: string;
  createdAt: string;
  decidedAt: string | null;
  decidedByName: string | null;
};
export type Said = { slot: string; value: string; quote: string };

type Head = {
  statementId: string;
  slot: string;
  slotName: string;
  type: string;
  value: string;
  quote: string;
  confirmed: boolean;
};
type Against = {
  statementId: string;
  documentId: string;
  documentTitle: string;
  value: string;
  quote: string;
};
export type Conflict = Head & {
  id: string;
  current: Against;
  status: "open" | "tolerated" | "resolved";
  reason: string | null;
  tolerateUntil: string | null;
};
export type Receipt = {
  repeats: (Head & { current: Against })[];
  new: Head[];
  conflicts: Conflict[];
  unjudged: (Head & { current: Against })[];
  notChecked: { slot: string; slotName: string; type: string }[];
};

export type Answer = {
  slot: string;
  slotName: string;
  type: string;
  value: string | null;
  quote: string | null;
  documentId: string | null;
  documentTitle: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  proposedIn: { id: string; title: string }[];
};

export const LAUNCH = "We launch on 5 March 2027.";
export const PRICE = "The price is 40 USD per seat.";
export const TEXT = `<p>${LAUNCH}</p><p>${PRICE}</p>`;
export const WHEN: Said = {
  slot: "launch_date",
  value: "2027-03-05",
  quote: "5 March 2027",
};
export const HOW_MUCH: Said = { slot: "price", value: "40", quote: "40 USD" };

export function filing(world: DocumentWorld) {
  const { ws, owner } = world;
  const topicBase = (topicId: string) => `/topic/workspace/${ws}/${topicId}`;
  const docBase = (id: string) => `/document/workspace/${ws}/${id}`;
  const ok = async (response: Response) => {
    expect(response.status, await response.clone().text()).toBe(200);
    return response.json();
  };
  const api = {
    topic: async (name = "Launch plan") =>
      (
        (await ok(
          await world.as(owner)(
            "/topic",
            json("POST", {
              workspaceId: ws,
              name,
              projectId: world.alpha.id,
            }),
          ),
        )) as { id: string }
      ).id,
    slotsOf: (user: Member, topicId: string) =>
      world.as(user)(`${topicBase(topicId)}/slots`),
    postSlot: (user: Member, topicId: string, body: Record<string, unknown>) =>
      world.as(user)(`${topicBase(topicId)}/slots`, json("POST", body)),
    addSlot: async (topicId: string, body: Record<string, unknown>) =>
      (await ok(await api.postSlot(owner, topicId, body))) as Slot,
    write: async (title: string, content: string) =>
      (
        (await ok(
          await world.as(owner)(
            "/document",
            json("POST", {
              workspaceId: ws,
              title,
              content,
              projectId: world.alpha.id,
            }),
          ),
        )) as { id: string }
      ).id,
    file: async (topicId: string, id: string) => {
      await ok(
        await world.as(owner)(
          `${topicBase(topicId)}/document/${id}`,
          json("PUT"),
        ),
      );
      return id;
    },
    filed: async (topicId: string, title = "Launch plan v2", content = TEXT) =>
      api.file(topicId, await api.write(title, content)),
    edit: async (id: string, content: string) =>
      ok(await world.as(owner)(docBase(id), json("PATCH", { content }))),
    statementsOf: async (id: string, user: Member = owner) =>
      (await ok(
        await world.as(user)(`${docBase(id)}/statements`),
      )) as Statement[],
    post: (id: string, body: Said, user: Member = owner) =>
      world.as(user)(`${docBase(id)}/statements`, json("POST", body)),
    add: async (id: string, body: Said) =>
      (await ok(await api.post(id, body))) as Statement,
    decide: (
      id: string,
      statementId: string,
      verb: "confirm" | "reject",
      body?: unknown,
    ) =>
      world.as(owner)(
        `${docBase(id)}/statements/${statementId}/${verb}`,
        json("POST", body),
      ),
    chatSave: async (markdown: string, idempotencyKey = "key-1") =>
      (await ok(
        await world.as(owner)(
          "/document/file",
          json("POST", {
            workspaceId: ws,
            title: "Launch plan v3",
            markdown,
            idempotencyKey,
          }),
        ),
      )) as { id: string; topics: { id: string; slots: unknown[] }[] },
    settle: (id: string, body: unknown) =>
      world.as(owner)(`${docBase(id)}/settle`, json("POST", body)),
    // Approve a document as the topic's current one.
    approve: (topicId: string, id: string, user: Member = owner) =>
      world.as(user)(
        `${topicBase(topicId)}/document/${id}/current`,
        json("POST", { reason: "Agreed." }),
      ),
    receipt: async (id: string, user: Member = owner) =>
      (await ok(await world.as(user)(`${docBase(id)}/receipt`))) as Receipt,
    current: async (topic: string, slot?: string, user: Member = owner) =>
      (await ok(
        await world.as(user)(
          `/topic/workspace/${ws}/current?` +
            new URLSearchParams(slot ? { topic, slot } : { topic }),
        ),
      )) as { topics: { id: string; answers: Answer[] }[] },
    settleConflict: (
      id: string,
      conflictId: string,
      body: unknown,
      user: Member = owner,
    ) =>
      world.as(user)(
        `${docBase(id)}/conflicts/${conflictId}/decide`,
        json("POST", body),
      ),
  };
  return api;
}

// A topic with a date and a number slot, and a document filed on it.
export async function setup() {
  const world = await buildDocumentWorld();
  const api = filing(world);
  const topicId = await api.topic();
  const date = await api.addSlot(topicId, {
    name: "Launch date",
    type: "date",
  });
  const price = await api.addSlot(topicId, { name: "Price", type: "number" });
  const docId = await api.filed(topicId);
  return { world, api, topicId, docId, date, price };
}
