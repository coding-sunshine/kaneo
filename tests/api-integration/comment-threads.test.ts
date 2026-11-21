import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type Activity = {
  id: string;
  type: string;
  parentId: string | null;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolvingCommentId: string | null;
  updatedAt: string;
  reactions: Array<{ emoji: string; userIds: string[] }>;
  subscribedToThread: boolean | null;
};

async function createTask(workspaceId: string, title: string) {
  const { project, columns } = await createProjectFixture({ workspaceId });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title,
      status: "to-do",
      columnId: columns.todo.id,
      priority: "medium",
      number: 1,
      position: 1,
    })
    .returning();
  return task;
}

describe("API integration: comment threads, resolve and reactions", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function setup() {
    const member = await createWorkspaceMember();
    const task = await createTask(member.workspace.id, "Threads");
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const send = (path: string, method: string, body: unknown) =>
      app.request(`/api/activity/${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const comment = async (comment: string, parentId?: string) => {
      const response = await send("comment", "POST", {
        taskId: task.id,
        comment,
        parentId,
      });
      expect(response.status).toBe(200);
      return (await response.json()) as Activity;
    };
    const feed = async () => {
      const response = await app.request(`/api/activity/${task.id}`);
      expect(response.status).toBe(200);
      const rows = (await response.json()) as Activity[];
      return new Map(rows.map((row) => [row.id, row]));
    };
    return { member, task, app, send, comment, feed };
  }

  it("nests replies one level deep and rejects parents on other tasks", async () => {
    const { member, task, send, comment, feed } = await setup();
    const root = await comment("Root");
    const reply = await comment("Reply", root.id);
    const replyToReply = await comment("Reply to reply", reply.id);

    expect(reply.parentId).toBe(root.id);
    expect(replyToReply.parentId).toBe(root.id);
    expect((await feed()).get(reply.id)?.parentId).toBe(root.id);

    const otherTask = await createTask(member.workspace.id, "Other");
    const [foreign] = await db
      .insert(schema.activityTable)
      .values({ taskId: otherTask.id, type: "comment", content: "Elsewhere" })
      .returning();
    const crossTask = await send("comment", "POST", {
      taskId: task.id,
      comment: "Sneaky",
      parentId: foreign.id,
    });
    expect(crossTask.status).toBe(400);
  });

  it("resolves from a reply as the resolution, and reopens", async () => {
    const { member, send, comment, feed } = await setup();
    const root = await comment("Question");
    const answer = await comment("Answer", root.id);

    const resolved = await send("comment/resolve", "POST", {
      activityId: answer.id,
    });
    expect(resolved.status).toBe(200);
    const after = (await feed()).get(root.id);
    expect(after).toMatchObject({
      resolvedByUserId: member.user.id,
      resolvingCommentId: answer.id,
    });
    expect(after?.resolvedAt).not.toBeNull();
    expect(after?.updatedAt).toBe(root.updatedAt);

    expect(
      (await send("comment/unresolve", "POST", { activityId: root.id })).status,
    ).toBe(200);
    expect((await feed()).get(root.id)).toMatchObject({
      resolvedAt: null,
      resolvedByUserId: null,
      resolvingCommentId: null,
    });

    await send("comment/resolve", "POST", { activityId: root.id });
    expect((await feed()).get(root.id)?.resolvingCommentId).toBeNull();
  });

  it("adds reactions idempotently, aggregates them, and removes them", async () => {
    const { member, send, comment, feed } = await setup();
    const root = await comment("Ship it");

    for (const emoji of ["👍", "👍", "🎉"]) {
      const response = await send("comment/reaction", "POST", {
        activityId: root.id,
        emoji,
      });
      expect(response.status).toBe(200);
    }
    expect((await feed()).get(root.id)?.reactions).toEqual([
      { emoji: "👍", userIds: [member.user.id] },
      { emoji: "🎉", userIds: [member.user.id] },
    ]);

    await send("comment/reaction", "DELETE", {
      activityId: root.id,
      emoji: "👍",
    });
    expect((await feed()).get(root.id)?.reactions).toEqual([
      { emoji: "🎉", userIds: [member.user.id] },
    ]);
  });

  it("deletes a thread's replies and reactions with its top-level comment", async () => {
    const { send, comment } = await setup();
    const root = await comment("Root");
    const reply = await comment("Reply", root.id);
    await send("comment/reaction", "POST", {
      activityId: reply.id,
      emoji: "👀",
    });

    expect(
      (await send("comment", "DELETE", { activityId: root.id })).status,
    ).toBe(200);
    const left = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.id, reply.id));
    expect(left).toHaveLength(0);
    expect(await db.select().from(schema.commentReactionTable)).toHaveLength(0);
  });

  it("blocks reactions and resolve on another workspace's comment", async () => {
    const { send } = await setup();
    const stranger = await createWorkspaceMember();
    const strangerTask = await createTask(stranger.workspace.id, "Private");
    const [privateComment] = await db
      .insert(schema.activityTable)
      .values({ taskId: strangerTask.id, type: "comment", content: "Private" })
      .returning();

    for (const [path, method, body] of [
      [
        "comment/reaction",
        "POST",
        { activityId: privateComment.id, emoji: "👍" },
      ],
      ["comment/resolve", "POST", { activityId: privateComment.id }],
    ] as const) {
      expect([403, 404]).toContain((await send(path, method, body)).status);
    }
  });

  it("custom emoji reactions require an emoji from the workspace", async () => {
    const { member, send, comment, feed } = await setup();
    const root = await comment("React to me");
    const react = (emoji: string, method = "POST") =>
      send("comment/reaction", method, { activityId: root.id, emoji });

    expect((await react(":party_parrot:")).status).toBe(400);
    // A native emoji and removal never need a workspace lookup.
    expect((await react("👍")).status).toBe(200);
    expect((await react(":party_parrot:", "DELETE")).status).toBe(200);

    await db.insert(schema.workspaceEmojiTable).values({
      workspaceId: member.workspace.id,
      name: "party_parrot",
      objectKey: "workspace/x/emoji/emoji-v1",
      mimeType: "image/png",
      version: "v1",
      createdBy: member.user.id,
    });
    expect((await react(":party_parrot:")).status).toBe(200);
    expect((await feed()).get(root.id)?.reactions).toContainEqual({
      emoji: ":party_parrot:",
      userIds: [member.user.id],
    });

    // Deleting the emoji blocks new reactions but existing ones can be removed.
    await db.delete(schema.workspaceEmojiTable);
    expect((await react(":party_parrot:")).status).toBe(400);
    expect((await react(":party_parrot:", "DELETE")).status).toBe(200);
  });

  describe("thread subscriptions", () => {
    async function twoUsers() {
      const ctx = await setup();
      const [other] = await db
        .insert(schema.userTable)
        .values({
          id: `user-other-${ctx.task.id}`,
          email: `other-${ctx.task.id}@example.com`,
          emailVerified: true,
          name: "Other",
        })
        .returning();
      await db.insert(schema.workspaceUserTable).values({
        workspaceId: ctx.member.workspace.id,
        userId: other.id,
        role: "member",
        joinedAt: new Date(),
      });
      const as = (user: typeof other) => mockAuthenticatedSession(user);
      const notified = async (userId: string, type: string) =>
        (
          await db
            .select()
            .from(schema.notificationTable)
            .where(
              and(
                eq(schema.notificationTable.userId, userId),
                eq(schema.notificationTable.type, type),
              ),
            )
        ).length;
      return { ...ctx, owner: ctx.member.user, other, as, notified };
    }

    it("unsubscribe from thread stops reply notifications", async () => {
      const { owner, other, as, send, comment, feed, notified } =
        await twoUsers();
      const root = await comment("Root");
      expect((await feed()).get(root.id)?.subscribedToThread).toBe(true);

      as(other);
      await comment("First reply", root.id);
      expect(await notified(owner.id, "task_comment")).toBe(1);

      as(owner);
      const reply = (await feed()).get(root.id);
      expect(reply?.subscribedToThread).toBe(true);
      expect(
        (await send("comment/subscription", "DELETE", { activityId: root.id }))
          .status,
      ).toBe(200);
      expect((await feed()).get(root.id)?.subscribedToThread).toBe(false);

      as(other);
      await comment("Second reply", root.id);
      expect(await notified(owner.id, "task_comment")).toBe(1);
    });

    it("subscribe to thread adds reply notifications", async () => {
      const { owner, other, as, send, comment, feed, notified } =
        await twoUsers();
      const root = await comment("Root");
      const reply = await comment("Reply", root.id);
      await comment("Quiet reply", root.id);
      expect(await notified(other.id, "task_comment")).toBe(0);

      as(other);
      expect((await feed()).get(root.id)?.subscribedToThread).toBe(false);
      // Subscribing from a reply acts on the thread's root.
      const response = await send("comment/subscription", "POST", {
        activityId: reply.id,
      });
      expect(await response.json()).toEqual({
        activityId: root.id,
        subscribed: true,
      });
      expect((await feed()).get(root.id)?.subscribedToThread).toBe(true);
      expect((await feed()).get(reply.id)?.subscribedToThread).toBeNull();

      as(owner);
      await comment("Loud reply", root.id);
      expect(await notified(other.id, "task_comment")).toBe(1);
    });

    it("mention in a reply resubscribes to the thread", async () => {
      const { owner, other, as, send, comment, notified } = await twoUsers();
      const root = await comment("Root");
      await send("comment/subscription", "DELETE", { activityId: root.id });

      as(other);
      await comment(
        `Ping <kaneo-mention id="${owner.id}"></kaneo-mention>`,
        root.id,
      );
      expect(await notified(owner.id, "task_mention")).toBe(1);
      expect(await notified(owner.id, "task_comment")).toBe(0);

      await comment("Plain reply", root.id);
      expect(await notified(owner.id, "task_comment")).toBe(1);

      // A mention of an unknown user id must not fail the comment.
      await comment(`Hi <kaneo-mention id="nope"></kaneo-mention>`, root.id);
    });
  });
});
