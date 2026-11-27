import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type Seeded = Awaited<ReturnType<typeof createWorkspaceMember>>;

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const member = await createWorkspaceMember();
  const viewer = await createWorkspaceMember();
  const ws = owner.workspace.id;
  for (const [person, role] of [
    [member, "member"],
    [viewer, "viewer"],
  ] as const)
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: person.user.id,
      role,
      joinedAt: new Date(),
    });
  const { project } = await createProjectFixture({ workspaceId: ws });
  const { app } = createApp();
  const base = `/api/chat/workspace/${ws}/channels`;
  const as = (person: Seeded) => {
    mockAuthenticatedSession(person.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const channel = async (name: string, isPrivate = false) =>
    (await as(owner)(base, json("POST", { name, isPrivate }))).json();
  const post = async (channelId: string, body: string) =>
    (
      await as(owner)(`${base}/${channelId}/messages`, json("POST", { body }))
    ).json();
  const pub = await channel("general");
  const priv = await channel("leads", true);
  const other = await channel("random");
  const message = await post(pub.id, "hi from chat");
  const secret = await post(priv.id, "secret plan");
  const createTask = (
    person: Seeded,
    sourceMessage?: { channelId: string; messageId: string },
    projectId = project.id,
  ) =>
    as(person)(
      `/api/task/${projectId}`,
      json("POST", {
        title: "From chat",
        description: "",
        priority: "no-priority",
        status: "to-do",
        ...(sourceMessage ? { sourceMessage } : {}),
      }),
    );
  const task = await (await createTask(owner)).json();
  const activities = async (taskId: string) =>
    (await as(owner)(`/api/activity/${taskId}`)).json() as Promise<
      {
        type: string;
        content: string | null;
        eventData: Record<string, unknown> | null;
      }[]
    >;
  const addToTicket = (
    person: Seeded,
    taskId: string,
    channelId = pub.id,
    messageId = message.id,
  ) =>
    as(person)(
      `${base}/${channelId}/messages/${messageId}/ticket-comment`,
      json("POST", { taskId }),
    );
  return {
    owner,
    member,
    viewer,
    ws,
    project,
    pub,
    priv,
    other,
    message,
    secret,
    task,
    createTask,
    activities,
    addToTicket,
  };
}

describe("API integration: tickets from chat messages", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("creates a ticket that links back to its source message", async () => {
    const { member, pub, message, createTask, activities } = await setup();

    const response = await createTask(member, {
      channelId: pub.id,
      messageId: message.id,
    });
    expect(response.status).toBe(200);
    const created = await response.json();

    const entry = (await activities(created.id)).find(
      (activity) => activity.type === "created_from_chat_message",
    );
    expect(entry?.eventData).toEqual({
      channelId: pub.id,
      messageId: message.id,
    });
  });

  it("refuses a source message the creator cannot read, and makes no ticket", async () => {
    const { member, priv, pub, other, secret, message, createTask, project } =
      await setup();
    const before = await db
      .select({ id: schema.taskTable.id })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, project.id));

    // A private channel the member is not in.
    expect(
      (await createTask(member, { channelId: priv.id, messageId: secret.id }))
        .status,
    ).toBe(400);
    // A message id under the wrong, readable channel.
    expect(
      (await createTask(member, { channelId: other.id, messageId: message.id }))
        .status,
    ).toBe(400);
    // A channel of another workspace.
    const stranger = await createWorkspaceMember({ role: "owner" });
    const { project: theirs } = await createProjectFixture({
      workspaceId: stranger.workspace.id,
    });
    expect(
      (
        await createTask(
          stranger,
          { channelId: pub.id, messageId: message.id },
          theirs.id,
        )
      ).status,
    ).toBe(400);

    const after = await db
      .select({ id: schema.taskTable.id })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, project.id));
    expect(after).toHaveLength(before.length);
  });

  it("adds a message to a ticket as a comment with a link back and a system entry", async () => {
    const { member, ws, pub, message, task, addToTicket, activities } =
      await setup();

    const response = await addToTicket(member, task.id);
    expect(response.status).toBe(200);
    const comment = await response.json();
    expect(comment.type).toBe("comment");
    expect(comment.content).toContain("> hi from chat");
    expect(comment.content).toContain(
      `/dashboard/workspace/${ws}/channels/${pub.id}?messageId=${message.id}`,
    );

    const feed = await activities(task.id);
    const entry = feed.find(
      (activity) => activity.type === "chat_message_added",
    );
    expect(entry?.eventData).toEqual({
      channelId: pub.id,
      messageId: message.id,
      commentId: comment.id,
    });
    expect(entry?.content).toBeNull();
  });

  it("lets a viewer do neither", async () => {
    const { viewer, pub, message, task, createTask, addToTicket } =
      await setup();
    expect((await addToTicket(viewer, task.id)).status).toBe(403);
    expect(
      (await createTask(viewer, { channelId: pub.id, messageId: message.id }))
        .status,
    ).toBe(403);
  });

  it("hides a private channel's message from a non-member", async () => {
    const { member, priv, secret, task, addToTicket, activities } =
      await setup();
    expect(
      (await addToTicket(member, task.id, priv.id, secret.id)).status,
    ).toBe(404);
    expect(
      (await activities(task.id)).filter(
        (activity) => activity.type === "comment",
      ),
    ).toHaveLength(0);
  });

  it("answers 404 for a message id under another channel", async () => {
    const { member, other, message, task, addToTicket } = await setup();
    expect(
      (await addToTicket(member, task.id, other.id, message.id)).status,
    ).toBe(404);
  });

  it("refuses a ticket of another workspace", async () => {
    const { member, addToTicket } = await setup();
    const stranger = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: stranger.workspace.id,
    });
    const [theirTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Theirs",
        status: "to-do",
        number: 1,
        position: 1,
      })
      .returning();
    expect((await addToTicket(member, theirTask!.id)).status).toBe(404);
    expect(
      await db
        .select({ id: schema.activityTable.id })
        .from(schema.activityTable)
        .where(eq(schema.activityTable.taskId, theirTask!.id)),
    ).toHaveLength(0);
  });

  it("refuses a ticket in a private team the caller cannot open", async () => {
    const { member, project, task, addToTicket } = await setup();
    await db
      .update(schema.projectTable)
      .set({ isPrivate: true })
      .where(eq(schema.projectTable.id, project.id));
    expect((await addToTicket(member, task.id)).status).toBe(404);
  });
});
