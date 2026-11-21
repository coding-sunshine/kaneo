import { asc, eq, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  commentThreadSubscriptionTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import createNotification from "../../notification/controllers/create-notification";
import { subscribeUsers } from "../../task/controllers/task-subscribers";
import { parseMentionIds } from "../../utils/parse-mentions";
import {
  applyThreadOverrides,
  defaultThreadSubscribers,
} from "../thread-subscribers";
import { upsertThreadSubscription } from "./set-thread-subscription";

/** Everyone following the thread: defaults plus each user's override. */
async function threadSubscribers(rootId: string, assigneeId: string | null) {
  const [comments, overrides] = await Promise.all([
    db
      .select({ userId: activityTable.userId, content: activityTable.content })
      .from(activityTable)
      .where(
        or(eq(activityTable.id, rootId), eq(activityTable.parentId, rootId)),
      )
      .orderBy(asc(activityTable.createdAt)),
    db
      .select({
        userId: commentThreadSubscriptionTable.userId,
        subscribed: commentThreadSubscriptionTable.subscribed,
      })
      .from(commentThreadSubscriptionTable)
      .where(eq(commentThreadSubscriptionTable.activityId, rootId)),
  ]);
  return applyThreadOverrides(
    defaultThreadSubscribers(comments, assigneeId),
    overrides,
  );
}

/** The top-level comment a reply joins; replies to replies join the same thread. */
async function threadRoot(taskId: string, parentId: string) {
  const [parent] = await db
    .select({
      id: activityTable.id,
      taskId: activityTable.taskId,
      type: activityTable.type,
      parentId: activityTable.parentId,
      userId: activityTable.userId,
    })
    .from(activityTable)
    .where(eq(activityTable.id, parentId))
    .limit(1);

  // Workspace access was checked against taskId, so the parent must be on
  // that task or a reply could attach to another workspace's comment.
  if (!parent || parent.taskId !== taskId || parent.type !== "comment") {
    throw new HTTPException(400, {
      message: "Parent comment not found on this task",
    });
  }
  if (!parent.parentId) return parent;

  const [root] = await db
    .select({ id: activityTable.id, userId: activityTable.userId })
    .from(activityTable)
    .where(eq(activityTable.id, parent.parentId))
    .limit(1);
  return root ?? parent;
}

async function createComment(
  taskId: string,
  userId: string,
  content: string,
  external?: { userName: string; source: string },
  parentId?: string,
) {
  const parent = parentId ? await threadRoot(taskId, parentId) : null;

  const [activity] = await db
    .insert(activityTable)
    .values({
      taskId,
      type: "comment",
      userId,
      content,
      parentId: parent?.id ?? null,
      ...(external
        ? {
            externalUserName: external.userName,
            externalSource: external.source,
          }
        : {}),
    })
    .returning();

  if (!activity) {
    throw new HTTPException(500, {
      message: "Failed to create activity",
    });
  }

  if (!external) await subscribeUsers(db, taskId, [userId]);

  const [user] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId));

  const [task] = await db
    .select({
      assigneeId: taskTable.userId,
      projectId: taskTable.projectId,
      title: taskTable.title,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId));

  if (task) {
    await publishEvent("comment.created", {
      ...activity,
      comment: `**${user?.name}** commented:\n> ${content}`,
      projectId: task.projectId,
    });
  }

  // Notify any workspace members @mentioned in the comment (not the author).
  const mentionedIds = parseMentionIds(content).filter((id) => id !== userId);
  for (const mentionedId of mentionedIds) {
    await createNotification({
      userId: mentionedId,
      type: "task_mention",
      eventData: {
        taskTitle: task?.title ?? null,
        mentionerName: user?.name ?? null,
        projectId: task?.projectId ?? null,
        workspaceId: task?.workspaceId ?? null,
      },
      resourceId: taskId,
      resourceType: "task",
    });
  }

  // A mention in a thread subscribes you to it, even if you had opted out.
  if (parent) {
    for (const mentionedId of mentionedIds) {
      await upsertThreadSubscription(parent.id, mentionedId, true);
    }
  }

  // The assignee hears about every top-level comment; a reply goes to the
  // thread's subscribers.
  const candidates = parent
    ? await threadSubscribers(parent.id, task?.assigneeId ?? null)
    : new Set(task?.assigneeId ? [task.assigneeId] : []);
  const recipients = new Set(
    [...candidates].filter((id) => id !== userId && !mentionedIds.includes(id)),
  );
  for (const recipientId of task ? recipients : []) {
    await createNotification({
      userId: recipientId,
      type: "task_comment",
      eventData: {
        taskTitle: task?.title ?? null,
        commenterName: user?.name ?? null,
        commentPreview: content.slice(0, 160),
        projectId: task?.projectId ?? null,
        workspaceId: task?.workspaceId ?? null,
      },
      resourceId: taskId,
      resourceType: "task",
    });
  }

  return activity;
}

export default createComment;
