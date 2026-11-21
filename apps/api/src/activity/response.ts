import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

const activityTypeDescription =
  "One of: comment, task, create, status_changed, priority_changed, assignee_changed, unassigned, due_date_changed, title_changed, description_changed.";

export const activitySchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    type: z.string().openapi({ description: activityTypeDescription }),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
    userId: z.string().nullable(),
    content: z.string().nullable(),
    eventData: z.unknown().openapi({
      description:
        "Type-specific payload, e.g. { oldStatus, newStatus } for status_changed. Null for plain comments.",
    }),
    externalUserName: z.string().nullable().openapi({
      description: "Set when the activity was imported from another tool.",
    }),
    externalUserAvatar: z.string().nullable(),
    externalSource: z.string().nullable().openapi({
      description:
        "The tool it was imported from: planka, trello, jira, plane, linear, kaneo, or a connected forge such as github.",
    }),
    externalUrl: z.string().nullable(),
    parentId: z.string().nullable().openapi({
      description:
        "The top-level comment this reply belongs to. Null for top-level comments and events.",
    }),
    resolvedAt: nullableResponseTimestamp.openapi({
      description: "Set on a top-level comment when its thread is resolved.",
    }),
    resolvedByUserId: z.string().nullable(),
    resolvingCommentId: z.string().nullable().openapi({
      description:
        "The reply shown as the thread's resolution. Null when resolved from the top-level comment.",
    }),
  })
  .openapi("Activity");

export const activityListSchema = z.array(
  activitySchema
    .extend({
      reactions: z
        .array(z.object({ emoji: z.string(), userIds: z.array(z.string()) }))
        .openapi({
          description:
            "Emoji reactions on a comment, in the order each emoji was first used.",
        }),
      createdIssues: z
        .array(
          z
            .object({
              id: z.string(),
              projectId: z.string(),
              projectSlug: z.string(),
              number: z.number().nullable(),
              title: z.string(),
              status: z.string(),
              statusIcon: z.string().nullable(),
              isCompleted: z.boolean(),
              isSubIssue: z.boolean().openapi({
                description: "Whether the task has a parent task.",
              }),
              creatorId: z.string().nullable(),
              creatorName: z.string().nullable(),
            })
            .openapi("CommentCreatedIssue"),
        )
        .openapi({
          description:
            "Tasks created from this comment that you can see, oldest first. Empty on events.",
        }),
      subscribedToThread: z.boolean().nullable().openapi({
        description:
          "Whether you follow this comment's thread. Set on top-level comments only; null on replies and events.",
      }),
    })
    .openapi("TaskActivity"),
);

export const workspaceActivityListSchema = z.array(
  z
    .object({
      id: z.string(),
      type: z.string().openapi({ description: activityTypeDescription }),
      createdAt: responseTimestamp,
      eventData: z.unknown().openapi({
        description:
          "Type-specific payload. For status_changed, oldStatus/newStatus are slugs and oldStatusName/newStatusName carry current configured column names when available.",
      }),
      excerpt: z.string().nullable().openapi({
        description:
          "Plain-text preview of the stored content, at most 240 characters: the comment body, or the description older system events carry instead of eventData.",
      }),
      userId: z.string().nullable(),
      userName: z.string().nullable(),
      userImage: z.string().nullable(),
      externalUserName: z.string().nullable(),
      externalUserAvatar: z.string().nullable(),
      taskId: z.string(),
      taskTitle: z.string(),
      taskNumber: z.number().nullable(),
      projectId: z.string(),
      projectSlug: z.string(),
    })
    .openapi("WorkspaceActivity"),
);
