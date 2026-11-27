import { extractAssetIds } from "../../storage/cleanup-assets";
import {
  findSourceMessage,
  type SourceMessage,
} from "../../chat/controllers/find-source-message";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  assetTable,
  columnTable,
  customFieldDefinitionTable,
  customFieldValueTable,
  taskTable,
  taskTopicTable,
  projectTable,
  userTable,
} from "../../database/schema";
import {
  findNewHiddenPicks,
  isChoiceType,
  readHiddenOptions,
  readOptions,
} from "../../custom-field/choice-options";
import { publishEvent } from "../../events";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";
import type { TaskRecurrence } from "../recurrence/schema";
import {
  assertRequiredCustomFields,
  assertValidTaskStatus,
  isCustomFieldValueEmpty,
} from "../validate-task-fields";
import { assertCycleInProject } from "./update-task-cycle";
import { assertTaskWorkProject } from "../../work-project/assert-task-work-project";
import { claimTaskNumber } from "./claim-task-numbers";
import { findSourceComment } from "./find-source-comment";
import { nextTaskPosition } from "./next-task-position";
import { mentionsDocument } from "../../task-document/find-links";
import {
  mayReference,
  syncTaskDescriptionReferences,
} from "../../reference/sync-references";
import { syncTaskDescriptionLinks } from "../../task-document/sync-links";
import { getTopic } from "../../topic/controllers/get-topic";
import { subscribeUsers } from "./task-subscribers";

type CustomFieldInput = {
  fieldId: string;
  value: string;
};

function deduplicateCustomFields(
  customFields?: CustomFieldInput[],
): CustomFieldInput[] | undefined {
  if (!customFields) {
    return undefined;
  }

  const fieldsById = new Map<string, CustomFieldInput>();

  for (const customField of customFields) {
    fieldsById.set(customField.fieldId, customField);
  }

  return Array.from(fieldsById.values());
}

async function createTask({
  projectId,
  currentUserId,
  userId,
  title,
  status,
  startDate,
  dueDate,
  description,
  priority,
  recurrence,
  customFields,
  draftAssetIds,
  workProjectId,
  workProjectMilestoneId,
  cycleId,
  sourceCommentId,
  sourceMessage,
  topicId,
}: {
  projectId: string;
  currentUserId: string;
  userId?: string;
  title: string;
  status: string;
  startDate?: Date;
  dueDate?: Date;
  description?: string;
  priority?: string;
  recurrence?: TaskRecurrence;
  customFields?: CustomFieldInput[];
  draftAssetIds?: string[];
  workProjectId?: string | null;
  workProjectMilestoneId?: string | null;
  cycleId?: string | null;
  sourceCommentId?: string;
  sourceMessage?: SourceMessage;
  topicId?: string;
}) {
  const resolvedStatus = status || "to-do";
  const resolvedPriority = priority || "no-priority";
  const normalizedCustomFields = deduplicateCustomFields(customFields);

  const normalizedUserId = userId?.trim() || undefined;

  await assertValidTaskStatus(resolvedStatus, projectId);
  await assertTaskWorkProject(projectId, workProjectId, workProjectMilestoneId);
  await assertCycleInProject(projectId, cycleId);
  const sourceComment = sourceCommentId
    ? await findSourceComment(
        sourceCommentId,
        await getProjectWorkspaceId(projectId),
        currentUserId,
      )
    : null;
  if (sourceMessage)
    await findSourceMessage(
      await getProjectWorkspaceId(projectId),
      sourceMessage,
      currentUserId,
    );
  // A topic the person cannot open answers like one that does not exist, and
  // no issue is made.
  if (topicId)
    await getTopic(
      await getProjectWorkspaceId(projectId),
      topicId,
      currentUserId,
    );

  const allFields = await db
    .select()
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.projectId, projectId));

  for (const input of normalizedCustomFields ?? []) {
    const field = allFields.find((candidate) => candidate.id === input.fieldId);
    if (!field || !isChoiceType(field.type)) continue;
    const hidden = readHiddenOptions(
      field.hiddenOptions,
      readOptions(field.options),
    );
    if (findNewHiddenPicks(input.value, null, field.type, hidden).length > 0) {
      throw new HTTPException(400, {
        message: `Custom field "${field.name}" has a hidden option selected.`,
      });
    }
  }

  const mergedCustomFields: CustomFieldInput[] = normalizedCustomFields ?? [];
  const providedFieldIds = new Set(mergedCustomFields.map((f) => f.fieldId));

  for (const field of allFields) {
    if (
      !providedFieldIds.has(field.id) &&
      field.required &&
      field.defaultValue != null &&
      !isCustomFieldValueEmpty(
        field.defaultValue,
        field.type as
          | "number"
          | "boolean"
          | "date"
          | "dropdown"
          | "multiselect",
      )
    ) {
      mergedCustomFields.push({
        fieldId: field.id,
        value: field.defaultValue,
      });
    }
  }

  await assertRequiredCustomFields(projectId, mergedCustomFields);

  let assignee: { name: string } | undefined;

  if (normalizedUserId) {
    await assertAssignableUser(
      normalizedUserId,
      await getProjectWorkspaceId(projectId),
      projectId,
    );

    [assignee] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, normalizedUserId));
  }

  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, projectId),
      eq(columnTable.slug, resolvedStatus),
    ),
  });
  // A rule would never fire on a task that starts out completed.
  if (recurrence && column?.isFinal)
    throw new HTTPException(400, {
      message: "Create the task in an open column to make it repeat",
    });

  const createdTask = await db.transaction(async (tx) => {
    const taskNumber = await claimTaskNumber(projectId, tx);
    // claimTaskNumber holds the team row now, so this sees any privacy change
    // that committed since the check above.
    if (normalizedUserId) {
      await assertAssignableUser(
        normalizedUserId,
        await getProjectWorkspaceId(projectId, tx),
        projectId,
        tx,
      );
    }
    const nextPosition = await nextTaskPosition(
      tx,
      projectId,
      resolvedStatus,
      column?.id ?? null,
    );

    const [task] = await tx
      .insert(taskTable)
      .values({
        projectId,
        userId: normalizedUserId ?? null,
        creatorId: currentUserId,
        workProjectId: workProjectId ?? null,
        workProjectMilestoneId: workProjectMilestoneId ?? null,
        cycleId: cycleId ?? null,
        cycleAddedAt: cycleId ? new Date() : null,
        sourceCommentId: sourceComment ? sourceCommentId : null,
        title: title || "",
        status: resolvedStatus,
        columnId: column?.id ?? null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        description: description || "",
        priority: resolvedPriority,
        recurrence: recurrence ?? null,
        number: taskNumber,
        position: nextPosition,
      })
      .returning();

    if (task)
      await subscribeUsers(tx, task.id, [currentUserId, normalizedUserId]);
    if (task && topicId)
      await tx.insert(taskTopicTable).values({ taskId: task.id, topicId });
    // Ids only: ticket readers may not be in the channel.
    if (task && sourceMessage)
      await tx.insert(activityTable).values({
        taskId: task.id,
        type: "created_from_chat_message",
        userId: currentUserId,
        eventData: {
          channelId: sourceMessage.channelId,
          messageId: sourceMessage.messageId,
        },
      });
    if (task && mentionsDocument(task.description))
      await syncTaskDescriptionLinks(
        tx,
        task.id,
        currentUserId,
        task.description,
      );
    if (task && mayReference(task.description))
      await syncTaskDescriptionReferences(tx, task.id, task.description);

    if (task && draftAssetIds?.length) {
      const referenced = extractAssetIds(description);
      const ids = [...new Set(draftAssetIds)].filter((id) =>
        referenced.has(id),
      );
      if (ids.length) {
        // claimTaskNumber already holds the project row lock in this transaction.
        const project = await tx.query.projectTable.findFirst({
          columns: { workspaceId: true },
          where: eq(projectTable.id, projectId),
        });
        if (!project)
          throw new HTTPException(404, { message: "Project not found" });
        const claimed = await tx
          .update(assetTable)
          .set({
            taskId: task.id,
            surface: "description",
            workspaceId: project.workspaceId,
          })
          .where(
            and(
              inArray(assetTable.id, ids),
              eq(assetTable.projectId, projectId),
              eq(assetTable.createdBy, currentUserId),
              eq(assetTable.surface, "draft"),
              isNull(assetTable.taskId),
            ),
          )
          .returning({ id: assetTable.id });
        if (claimed.length !== ids.length)
          throw new HTTPException(400, {
            message:
              "Some staged uploads are unavailable or belong to another owner/project",
          });
      }
    }

    if (task && mergedCustomFields.length) {
      await tx.insert(customFieldValueTable).values(
        mergedCustomFields.map(({ fieldId, value }) => ({
          taskId: task.id,
          fieldId,
          value: value.trim(),
        })),
      );
    }

    return task;
  });

  if (!createdTask) {
    throw new HTTPException(500, {
      message: "Failed to create task",
    });
  }

  await publishEvent("task.created", {
    ...createdTask,
    taskId: createdTask.id,
    userId: createdTask.userId ?? "",
    currentUserId: currentUserId,
    type: "created",
    content: null,
  });
  // The comment now lists this task, so its viewers refresh.
  if (sourceComment)
    await publishEvent("comment.updated", {
      id: sourceCommentId,
      taskId: sourceComment.taskId,
      projectId: sourceComment.projectId,
      userId: currentUserId,
    });

  return {
    ...createdTask,
    assigneeName: assignee?.name,
  };
}

export default createTask;
