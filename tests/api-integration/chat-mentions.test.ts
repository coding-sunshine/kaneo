import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { referenceTable } from "../../apps/api/src/database/schema";
import { settleEvents, subscribeToEvent } from "../../apps/api/src/events";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type Member = DocumentWorld["owner"];
type Mention = {
  kind: "user" | "task" | "document" | "project";
  ref: string;
  id: string | null;
  title: string | null;
  status: string | null;
  restricted: boolean;
};
type Message = { id: string; body: string; mentions: Mention[] };
type Reference = {
  kind: string;
  id: string;
  title: string;
  channelId?: string;
  places: string[];
};

const updatedChannels: string[] = [];
subscribeToEvent<{ channelId: string }>(
  "chat.message_updated",
  async ({ channelId }) => {
    updatedChannels.push(channelId);
  },
);

const person = (id: string) => `<kaneo-mention id="${id}"></kaneo-mention>`;
const documentAddress = (ws: string, id: string) =>
  `https://tracker.example/dashboard/workspace/${ws}/document/${id}`;
const projectAddress = (ws: string, id: string) =>
  `https://tracker.example/dashboard/workspace/${ws}/project/${id}/board`;

async function setup() {
  const world = await buildDocumentWorld();
  const { ws, owner, limited, open, as } = world;
  const channels = `/chat/workspace/${ws}/channels`;
  const createChannel = async (name: string, isPrivate = false) =>
    (await (
      await as(owner)(channels, json("POST", { name, isPrivate }))
    ).json()) as { id: string };
  const general = await createChannel("general");
  const leads = await createChannel("leads", true);
  for (const member of [limited, open])
    await as(member)(`${channels}/${general.id}/join`, json("POST"));
  const post = async (
    channelId: string,
    body: string,
    user: Member = owner,
  ) => {
    const response = await as(user)(
      `${channels}/${channelId}/messages`,
      json("POST", { body }),
    );
    expect(response.status).toBe(200);
    return (await response.json()) as Message;
  };
  const messages = async (user: Member, channelId = general.id) => {
    const response = await as(user)(`${channels}/${channelId}/messages`);
    expect(response.status).toBe(200);
    const text = await response.text();
    return { text, list: JSON.parse(text) as Message[] };
  };
  const references = async (user: Member, path: string) => {
    const response = await as(user)(`/reference${path}`);
    expect(response.status).toBe(200);
    return ((await response.json()) as { references: Reference[] }).references;
  };
  return {
    ...world,
    channels,
    general,
    leads,
    post,
    messages,
    references,
  };
}

const byKind = (message: Message | undefined, kind: Mention["kind"]) =>
  message?.mentions.find((mention) => mention.kind === kind);

describe("API integration: chat mentions", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    updatedChannels.length = 0;
  });

  it("shows people, tickets, documents and teams as live cards", async () => {
    const world = await setup();
    const { ws, owner, limited, alpha, alphaTask, docs, general } = world;
    await world.post(
      general.id,
      `${person(limited.id)} see ALPHA-1 and ${documentAddress(ws, docs.workspace)} and ${projectAddress(ws, alpha.id)}`,
    );

    const [message] = (await world.messages(owner)).list;
    expect(byKind(message, "user")).toMatchObject({
      id: limited.id,
      title: limited.name,
      restricted: false,
    });
    expect(byKind(message, "task")).toMatchObject({
      ref: "ALPHA-1",
      id: alphaTask.id,
      title: "Alpha issue",
      status: alphaTask.status,
      restricted: false,
    });
    expect(byKind(message, "document")).toMatchObject({
      id: docs.workspace,
      title: "leakdoc workspace",
    });
    expect(byKind(message, "project")).toMatchObject({
      id: alpha.id,
      title: "Alpha",
    });

    // A rename shows on the next read, and tells the channel to refetch.
    await world.as(owner)(
      `/task/title/${alphaTask.id}`,
      json("PUT", { title: "Alpha renamed" }),
    );
    await settleEvents();
    expect(updatedChannels).toContain(general.id);
    const [after] = (await world.messages(owner)).list;
    expect(byKind(after, "task")?.title).toBe("Alpha renamed");

    // A status change does the same.
    updatedChannels.length = 0;
    const moved = await world.as(owner)(
      `/task/status/${alphaTask.id}`,
      json("PUT", { status: "done" }),
    );
    expect(moved.status).toBe(200);
    await settleEvents();
    expect(updatedChannels).toContain(general.id);
    const [done] = (await world.messages(owner)).list;
    expect(byKind(done, "task")?.status).toBe("done");
  });

  it("shows a restricted item without its title to a reader who cannot open it", async () => {
    const world = await setup();
    const { ws, limited, beta, betaTask, docs, general } = world;
    await world.post(
      general.id,
      `BETA-1 ${documentAddress(ws, docs.private)} ${projectAddress(ws, beta.id)}`,
    );

    const { text, list } = await world.messages(limited);
    for (const kind of ["task", "document", "project"] as const)
      expect(byKind(list[0], kind)).toMatchObject({
        id: null,
        title: null,
        status: null,
        restricted: true,
      });
    expect(text).not.toContain(betaTask.title);
    expect(text).not.toContain("leakdoc private");
    expect(text).not.toContain('"Beta"');
    expect(text).not.toContain(betaTask.id);
  });

  it("lists the message under Mentioned in of each ticket, document and team", async () => {
    const world = await setup();
    const { ws, owner, open, alpha, alphaTask, docs, general } = world;
    const message = await world.post(
      general.id,
      `ALPHA-1 ${documentAddress(ws, docs.workspace)} ${projectAddress(ws, alpha.id)}`,
    );

    const expected = expect.objectContaining({
      kind: "message",
      id: message.id,
      title: "general",
      channelId: general.id,
      places: ["chat"],
    });
    for (const path of [
      `/task/${alphaTask.id}`,
      `/workspace/${ws}/document/${docs.workspace}`,
      `/project/${alpha.id}`,
    ]) {
      expect(await world.references(owner, path)).toContainEqual(expected);
      expect(await world.references(open, path)).toContainEqual(expected);
    }
    // Chat keeps its own table: the reference table gets no rows from it.
    expect(await db.select().from(referenceTable)).toEqual([]);
  });

  it("never shows a private channel's message to people outside it", async () => {
    const world = await setup();
    const { owner, open, alphaTask, leads } = world;
    await world.post(leads.id, "secret about ALPHA-1");

    const path = `/task/${alphaTask.id}`;
    expect(await world.references(owner, path)).toHaveLength(1);
    expect(await world.references(open, path)).toEqual([]);
  });

  it("forgets a mention when the message is edited or deleted", async () => {
    const world = await setup();
    const { owner, alphaTask, general, channels } = world;
    const message = await world.post(general.id, "ALPHA-1");
    const path = `/task/${alphaTask.id}`;
    const messagePath = `${channels}/${general.id}/messages/${message.id}`;

    await world.as(owner)(messagePath, json("PATCH", { body: "nothing" }));
    expect(await world.references(owner, path)).toEqual([]);

    await world.as(owner)(messagePath, json("PATCH", { body: "ALPHA-1" }));
    expect(await world.references(owner, path)).toHaveLength(1);

    await world.as(owner)(messagePath, json("DELETE"));
    expect(await world.references(owner, path)).toEqual([]);
  });

  it("names only members of the workspace", async () => {
    const world = await setup();
    const { owner, general } = world;
    await world.post(general.id, `${person("someone-else")} hi`);
    const [message] = (await world.messages(owner)).list;
    expect(message?.mentions).toEqual([]);
  });

  it("shows a guest only the people and channels they work with", async () => {
    const world = await setup();
    const { ws, owner, limited, beta, betaTask, general, channels } = world;
    // A guest on team Beta shares no team with `limited`, who has only Alpha.
    const guest = await addWorkspaceMember(ws);
    await restrictToProjects(ws, guest.id, [beta.id]);
    await db
      .update(schema.workspaceMemberAccessTable)
      .set({ guest: true })
      .where(eq(schema.workspaceMemberAccessTable.userId, guest.id));
    const leads = await world.as(owner)(
      channels,
      json("POST", { name: "guests", isPrivate: true }),
    );
    const guestChannel = (await leads.json()) as { id: string };
    await world.as(owner)(
      `${channels}/${guestChannel.id}/members`,
      json("POST", { userId: guest.id }),
    );
    await world.post(guestChannel.id, `${person(limited.id)} BETA-1`);
    await world.post(general.id, "also BETA-1");

    const { text, list } = await world.messages(guest, guestChannel.id);
    expect(byKind(list[0], "user")).toMatchObject({
      title: null,
      restricted: true,
    });
    expect(text).not.toContain(limited.name);
    expect(byKind(list[0], "task")?.title).toBe(betaTask.title);

    // The general channel is closed to the guest, so its message is not listed.
    const references = await world.references(guest, `/task/${betaTask.id}`);
    expect(references.map((reference) => reference.channelId)).toEqual([
      guestChannel.id,
    ]);
  });
});
