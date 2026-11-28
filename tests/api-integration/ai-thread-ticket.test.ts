import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { model, reply } from "./helpers/agent-model";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

vi.mock("../../apps/api/src/agent/openrouter", async (original) => ({
  ...(await original<object>()),
  createCompletion: vi.fn(async (messages: never) => {
    model.seen.push(messages);
    const next = model.queue.shift();
    if (!next) throw new Error("no scripted reply");
    return next;
  }),
}));

type User = typeof schema.userTable.$inferSelect;
type Proposal = {
  id: string;
  tool: string;
  status: string;
  diff: { field: string; from: string | null; to: string | null }[];
};
type ChatMessage = {
  id: string;
  body: string;
  userId: string;
  mentions: { kind: string; id: string | null }[];
};

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const mention = (user: User) =>
  `<kaneo-mention id="${user.id}">@${user.name}</kaneo-mention>`;

describe("API integration: ticket from a chat thread", () => {
  const { app } = createApp();
  let owner: User;
  let dana: User;
  let bystander: User;
  let ws: string;
  let team: Awaited<ReturnType<typeof createProjectFixture>>;
  let secretTeam: Awaited<ReturnType<typeof createProjectFixture>>;
  let workProjectId: string;
  let channelId: string;
  let rootId: string;

  const as = (user: User) => {
    mockAuthenticatedSession(user);
    return app;
  };
  const chat = `/api/chat/workspace`;
  const post = async (user: User, body: string, parentId?: string) => {
    const res = await as(user).request(
      `${chat}/${ws}/channels/${channelId}/messages`,
      json("POST", { body, parentId }),
    );
    expect(res.status, await res.clone().text()).toBe(200);
    return ((await res.json()) as { id: string }).id;
  };

  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
    const seeded = await createWorkspaceMember({ role: "owner" });
    owner = seeded.user;
    ws = seeded.workspace.id;
    dana = await addWorkspaceMember(ws, "member");
    bystander = await addWorkspaceMember(ws, "member");
    team = await createProjectFixture({ workspaceId: ws, slug: "pay" });
    secretTeam = await createProjectFixture({ workspaceId: ws });
    await db
      .update(schema.projectTable)
      .set({ name: "Mergers desk" })
      .where(eq(schema.projectTable.id, secretTeam.project.id));
    await db
      .insert(schema.labelTable)
      .values([
        { name: "Bug", color: "#ef4444", workspaceId: ws, taskId: null },
      ]);
    const [project] = await db
      .insert(schema.workProjectTable)
      .values({ workspaceId: ws, name: "Checkout" })
      .returning();
    workProjectId = project?.id ?? "";
    const created = await as(owner).request(
      `${chat}/${ws}/channels`,
      json("POST", { name: "support" }),
    );
    channelId = ((await created.json()) as { id: string }).id;
    rootId = await post(owner, "Checkout fails for EU cards since Monday.");
    await post(owner, "Seen on Visa and Mastercard.", rootId);
    await post(
      owner,
      `${mention(dana)} can you look? You built the 3DS flow.`,
      rootId,
    );
    await post(owner, "Logs show a 402 from the payment provider.", rootId);
    await post(owner, "Only when the card asks for a challenge.", rootId);
    await post(owner, "Customers are writing in, this is urgent.", rootId);
  });

  const suggestion = (overrides: object = {}) =>
    reply(
      JSON.stringify({
        title: "EU card payments fail on the 3DS challenge",
        description:
          "Since Monday, checkout fails for EU cards that ask for a 3DS challenge. The provider answers 402.",
        assigneeId: dana.id,
        labels: ["Bug", "Made up"],
        teamId: team.project.id,
        workProjectId,
        ...overrides,
      }),
    );

  const propose = (user: User = owner, messageId = rootId) =>
    as(user).request(
      `/api/agent/workspace/${ws}/channels/${channelId}/messages/${messageId}/ticket-proposal`,
      json("POST"),
    );

  const decide = (id: string, decision: "accept" | "decline", user = owner) =>
    as(user).request(
      `/api/agent/workspace/${ws}/proposals/${id}/${decision}`,
      json("POST"),
    );

  const thread = async (user: User = owner) => {
    const res = await as(user).request(
      `${chat}/${ws}/channels/${channelId}/messages/${rootId}/replies`,
    );
    expect(res.status).toBe(200);
    return (await res.json()) as ChatMessage[];
  };
  const tasks = () => db.select().from(schema.taskTable);

  it("proposes a ticket with a title, a description from the thread, a mentioned assignee, labels and a project", async () => {
    model.queue.push(suggestion());
    const res = await propose();
    expect(res.status, await res.clone().text()).toBe(200);
    const card = (await res.json()) as Proposal;
    expect(card).toMatchObject({
      tool: "create_ticket_from_thread",
      status: "pending",
    });
    const byField = Object.fromEntries(card.diff.map((c) => [c.field, c.to]));
    expect(byField).toEqual({
      team: team.project.name,
      title: "EU card payments fail on the 3DS challenge",
      description: expect.stringContaining("402"),
      assignee: dana.name,
      labels: "Bug",
      project: "Checkout",
    });
    // All six messages reached the model as data.
    const sent = JSON.stringify(model.seen[0]);
    for (const text of ["EU cards since Monday", "this is urgent", "402 from"])
      expect(sent).toContain(text);
    expect(await tasks()).toEqual([]);
  });

  it("creates the ticket on Accept, links it from the thread, and lists the thread under Mentioned in", async () => {
    model.queue.push(suggestion());
    const card = (await (await propose()).json()) as Proposal;
    const res = await decide(card.id, "accept");
    expect(res.status, await res.clone().text()).toBe(200);
    expect((await res.json()).status).toBe("accepted");

    const [task] = await tasks();
    expect(task).toMatchObject({
      projectId: team.project.id,
      title: "EU card payments fail on the 3DS challenge",
      userId: dana.id,
      workProjectId,
    });
    const labels = await db
      .select({ name: schema.labelTable.name })
      .from(schema.labelTable)
      .where(eq(schema.labelTable.taskId, task?.id ?? ""));
    expect(labels.map((label) => label.name)).toEqual(["Bug"]);

    const replies = await thread();
    expect(replies).toHaveLength(6);
    const link = replies.at(-1);
    expect(link?.userId).toBe(owner.id);
    expect(link?.mentions).toContainEqual(
      expect.objectContaining({ kind: "task", id: task?.id }),
    );

    const refs = await as(owner).request(`/api/reference/task/${task?.id}`);
    expect(refs.status).toBe(200);
    const { references } = (await refs.json()) as {
      references: { kind: string; id: string; channelId?: string }[];
    };
    expect(references).toContainEqual(
      expect.objectContaining({ kind: "message", channelId }),
    );
  });

  it("asks for a required field without a default, and creates the ticket with it", async () => {
    // As set up by the IT intake: required, with no default to fall back on.
    const [field] = await db
      .insert(schema.customFieldDefinitionTable)
      .values({
        projectId: team.project.id,
        name: "Category",
        type: "dropdown",
        required: true,
        options: ["Hardware", "Software"],
        position: 1,
      })
      .returning();
    const fieldId = field?.id ?? "";
    model.queue.push(suggestion());
    const card = (await (await propose()).json()) as Proposal & {
      needsFields: { projectId: string; fieldIds: string[] } | null;
    };
    expect(card.needsFields).toEqual({
      projectId: team.project.id,
      fieldIds: [fieldId],
    });

    // Without the value nothing runs and the card stays open.
    const missing = await decide(card.id, "accept");
    expect(missing.status, await missing.clone().text()).toBe(400);
    expect(await missing.text()).toContain("Category");
    expect(await tasks()).toEqual([]);

    const values = encodeURIComponent(
      JSON.stringify([{ fieldId, value: "Software" }]),
    );
    const res = await as(owner).request(
      `/api/agent/workspace/${ws}/proposals/${card.id}/accept?customFields=${values}`,
      json("POST"),
    );
    expect(res.status, await res.clone().text()).toBe(200);
    expect((await res.json()).status).toBe("accepted");
    const [task] = await tasks();
    const stored = await db
      .select({ value: schema.customFieldValueTable.value })
      .from(schema.customFieldValueTable)
      .where(eq(schema.customFieldValueTable.taskId, task?.id ?? ""));
    expect(stored).toEqual([{ value: "Software" }]);
  });

  it("creates nothing on Decline", async () => {
    model.queue.push(suggestion());
    const card = (await (await propose()).json()) as Proposal;
    const res = await decide(card.id, "decline");
    expect((await res.json()).status).toBe("declined");
    expect(await tasks()).toEqual([]);
    expect(await thread()).toHaveLength(5);
  });

  it("only assigns someone the thread mentions, and only labels the workspace has", async () => {
    model.queue.push(suggestion({ assigneeId: bystander.id }));
    const card = (await (await propose()).json()) as Proposal;
    const fields = card.diff.map((change) => change.field);
    expect(fields).not.toContain("assignee");
    expect(card.diff.find((c) => c.field === "labels")?.to).toBe("Bug");
  });

  it("never offers a team the asker cannot open, and refuses one the model makes up", async () => {
    await restrictToProjects(ws, dana.id, [team.project.id]);
    await as(dana).request(
      `${chat}/${ws}/channels/${channelId}/join`,
      json("POST"),
    );
    model.queue.push(suggestion({ teamId: secretTeam.project.id }));
    const res = await propose(dana);
    expect(res.status).toBe(422);
    expect(JSON.stringify(model.seen)).not.toContain("Mergers desk");
    expect(await db.select().from(schema.agentProposalTable)).toEqual([]);
  });

  it("hides a thread the asker cannot read and refuses a viewer", async () => {
    const leadsRes = await as(owner).request(
      `${chat}/${ws}/channels`,
      json("POST", { name: "leads", isPrivate: true }),
    );
    const leads = ((await leadsRes.json()) as { id: string }).id;
    const secret = await as(owner).request(
      `${chat}/${ws}/channels/${leads}/messages`,
      json("POST", { body: "Private plan" }),
    );
    const secretId = ((await secret.json()) as { id: string }).id;
    const hidden = await as(dana).request(
      `/api/agent/workspace/${ws}/channels/${leads}/messages/${secretId}/ticket-proposal`,
      json("POST"),
    );
    expect(hidden.status).toBe(404);
    const viewer = await addWorkspaceMember(ws, "viewer");
    expect((await propose(viewer)).status).toBe(403);
    expect(model.seen).toHaveLength(0);
  });

  it("asks only someone who may post in the thread, and creates nothing once they cannot", async () => {
    const outsider = await addWorkspaceMember(ws, "member");
    expect((await propose(outsider)).status).toBe(403);
    expect(model.seen).toHaveLength(0);

    model.queue.push(suggestion());
    const card = (await (await propose()).json()) as Proposal;
    await as(owner).request(
      `${chat}/${ws}/channels/${channelId}`,
      json("PATCH", { archived: true }),
    );
    const res = await decide(card.id, "accept");
    expect((await res.json()).status).toBe("failed");
    expect(await tasks()).toEqual([]);
    expect((await propose()).status).toBe(409);
  });

  it("only lets the person who asked decide, and answers 404 when AI is off", async () => {
    model.queue.push(suggestion());
    const card = (await (await propose()).json()) as Proposal;
    expect((await decide(card.id, "accept", dana)).status).toBe(404);
    delete process.env.OPENROUTER_API_KEY;
    expect((await propose()).status).toBe(404);
  });
});
