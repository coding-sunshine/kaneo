import type { SQLWrapper } from "drizzle-orm";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  documentTable,
  projectTable,
  taskTable,
  topicTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { documentParentName } from "../../document/controllers/list-documents";
import { documentVisibility, topicAccess } from "../../document/visibility";
import { canAccessProject } from "../../project-access/can-access-project";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { bodyVector, buildFtsQuery, ftsMatch, titleBodyVector } from "../fts";
import { escapeLikePattern } from "../like-pattern";
import { pickAcrossTypes } from "../pick-across-types";
import type { SearchResult } from "../search-result";
import { searchMessages } from "./search-messages";
import { searchPeople } from "./search-people";
import { TASK_SHORT_ID_PATTERN } from "../task-short-id";

type SearchParams = {
  query: string;
  userEmail?: string;
  userId?: string;
  type?:
    | "all"
    | "tasks"
    | "projects"
    | "workspaces"
    | "comments"
    | "activities"
    | "documents"
    | "messages"
    | "people";
  workspaceId?: string;
  projectId?: string;
  limit?: number;
};

function toDisplayCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getActivitySearchContent(
  type: string,
  content: string | null,
  eventData: unknown,
) {
  if (content) return content;
  if (!eventData || typeof eventData !== "object" || Array.isArray(eventData)) {
    return undefined;
  }

  const data = eventData as Record<string, unknown>;

  switch (type) {
    case "status_changed":
      return `changed status from ${toDisplayCase(String(data.oldStatus ?? ""))} to ${toDisplayCase(String(data.newStatus ?? ""))}`;
    case "priority_changed":
      return `changed priority from ${toDisplayCase(String(data.oldPriority ?? ""))} to ${toDisplayCase(String(data.newPriority ?? ""))}`;
    case "unassigned":
      return "unassigned the task";
    case "assignee_changed":
      return data.isSelfAssigned
        ? "assigned the task to themselves"
        : `assigned the task to ${String(data.newAssignee ?? "someone")}`;
    case "due_date_changed":
      if (!data.newDueDate) {
        return "cleared the due date";
      }
      if (!data.oldDueDate) {
        return `set due date to ${String(data.newDueDate)}`;
      }
      return `changed due date from ${String(data.oldDueDate)} to ${String(data.newDueDate)}`;
    case "title_changed":
      return `changed title from "${String(data.oldTitle ?? "")}" to "${String(data.newTitle ?? "")}"`;
    case "task":
      return "created the task";
    default:
      return undefined;
  }
}

async function globalSearch(params: SearchParams): Promise<{
  results: SearchResult[];
  totalCount: number;
  searchQuery: string;
}> {
  const {
    query,
    userId,
    userEmail,
    type = "all",
    workspaceId,
    projectId,
    limit = 20,
  } = params;

  let resolvedUserId = userId;
  if (!resolvedUserId && userEmail) {
    const user = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, userEmail))
      .limit(1);

    if (user.length > 0 && user[0]) {
      resolvedUserId = user[0].id;
    }
  }

  if (!resolvedUserId) {
    return { results: [], totalCount: 0, searchQuery: query };
  }

  const userWorkspaces = await db
    .select({ workspaceId: workspaceUserTable.workspaceId })
    .from(workspaceUserTable)
    .where(eq(workspaceUserTable.userId, resolvedUserId));

  const accessibleWorkspaceIds = userWorkspaces
    .map((w) => w.workspaceId)
    .filter(Boolean);

  if (
    accessibleWorkspaceIds.length === 0 ||
    (projectId && !(await canAccessProject(resolvedUserId, projectId)))
  ) {
    return { results: [], totalCount: 0, searchQuery: query };
  }

  const results: SearchResult[] = [];
  const searchPattern = `%${query.toLowerCase()}%`;

  const workspaceFilter = and(
    workspaceId
      ? eq(projectTable.workspaceId, workspaceId)
      : inArray(projectTable.workspaceId, accessibleWorkspaceIds),
    projectAccessCondition(resolvedUserId, projectTable.id),
  );

  // Check if query matches short-id pattern (e.g. "DEP-23"). `generateProjectSlug`
  // normalizes to NFKC before it stores a key, so the query is normalized too,
  // or a decomposed "ПА-23" would never reach the stored composed form.
  const shortIdMatch = query.normalize("NFKC").match(TASK_SHORT_ID_PATTERN);

  const shortIdNumber = Number(shortIdMatch?.[2]);

  // Ranked full-text search, except for very short queries and task keys like
  // "ABC-12", which keep the substring match.
  const fts = shortIdMatch ? null : buildFtsQuery(query);
  const exactTitle = (title: SQLWrapper) =>
    sql`LOWER(${title}) = LOWER(${query.trim()})`;

  if (type === "all" || type === "tasks") {
    const seenTaskIds = new Set<string>();

    // If query matches short-id pattern, look up by project slug + task number first
    if (
      shortIdMatch?.[1] &&
      Number.isSafeInteger(shortIdNumber) &&
      shortIdNumber > 0 &&
      shortIdNumber <= 2_147_483_647
    ) {
      const slug = shortIdMatch[1];
      const taskNumber = shortIdNumber;

      const shortIdTasks = await db
        .select({
          id: taskTable.id,
          title: taskTable.title,
          description: taskTable.description,
          projectId: taskTable.projectId,
          projectName: projectTable.name,
          projectSlug: projectTable.slug,
          workspaceId: projectTable.workspaceId,
          workspaceName: workspaceTable.name,
          userId: taskTable.userId,
          userName: userTable.name,
          createdAt: taskTable.createdAt,
          taskNumber: taskTable.number,
          priority: taskTable.priority,
          status: taskTable.status,
          archivedAt: taskTable.archivedAt,
        })
        .from(taskTable)
        .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .leftJoin(
          workspaceTable,
          eq(projectTable.workspaceId, workspaceTable.id),
        )
        .leftJoin(userTable, eq(taskTable.userId, userTable.id))
        .where(
          and(
            workspaceFilter,
            projectId ? eq(taskTable.projectId, projectId) : undefined,
            // A project key may hold `_`, which `ilike` reads as "any one
            // character", so `DE_-23` would also match a task in `DEP` and the
            // `limit(1)` below would pick whichever came back first. Escaping
            // keeps the case-insensitive comparison and drops the wildcards.
            ilike(projectTable.slug, escapeLikePattern(slug)),
            eq(taskTable.number, taskNumber),
          ),
        )
        .limit(1);

      for (const task of shortIdTasks) {
        seenTaskIds.add(task.id);
        results.push({
          id: task.id,
          type: "task",
          title: task.title,
          description: task.description || undefined,
          projectId: task.projectId,
          projectName: task.projectName || undefined,
          projectSlug: task.projectSlug || undefined,
          workspaceId: task.workspaceId || undefined,
          workspaceName: task.workspaceName || undefined,
          userId: task.userId || undefined,
          userName: task.userName || undefined,
          createdAt: task.createdAt,
          relevanceScore: 10, // Highest relevance for exact short-id match
          taskNumber: task.taskNumber || undefined,
          priority: task.priority || undefined,
          status: task.status,
          archivedAt: task.archivedAt,
        });
      }
    }

    // Also run text search for tasks
    const taskFts = fts
      ? ftsMatch(titleBodyVector(taskTable.title, taskTable.description), fts)
      : null;
    const taskRelevanceScore = taskFts
      ? sql<number>`CASE WHEN ${exactTitle(taskTable.title)} THEN 5 ELSE ${taskFts.score(3)} END`
      : sql<number>`
      CASE
        WHEN LOWER(${taskTable.title}) LIKE ${searchPattern} THEN 3
        WHEN LOWER(${taskTable.description}) LIKE ${searchPattern} THEN 2
        ELSE 1
      END
    `;

    const taskQuery = db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        description: taskTable.description,
        projectId: taskTable.projectId,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        workspaceId: projectTable.workspaceId,
        workspaceName: workspaceTable.name,
        userId: taskTable.userId,
        userName: userTable.name,
        createdAt: taskTable.createdAt,
        taskNumber: taskTable.number,
        priority: taskTable.priority,
        status: taskTable.status,
        archivedAt: taskTable.archivedAt,
        relevanceScore: taskRelevanceScore.as("relevanceScore"),
      })
      .from(taskTable)
      .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .where(
        and(
          workspaceFilter,
          projectId ? eq(taskTable.projectId, projectId) : undefined,
          taskFts?.match ??
            or(
              ilike(taskTable.title, searchPattern),
              ilike(taskTable.description, searchPattern),
            ),
        ),
      )
      .orderBy(desc(taskRelevanceScore), desc(taskTable.createdAt))
      .limit(limit);

    const tasks = await taskQuery;

    for (const task of tasks) {
      if (seenTaskIds.has(task.id)) continue;
      results.push({
        id: task.id,
        type: "task",
        title: task.title,
        description: task.description || undefined,
        projectId: task.projectId,
        projectName: task.projectName || undefined,
        projectSlug: task.projectSlug || undefined,
        workspaceId: task.workspaceId || undefined,
        workspaceName: task.workspaceName || undefined,
        userId: task.userId || undefined,
        userName: task.userName || undefined,
        createdAt: task.createdAt,
        relevanceScore: task.relevanceScore,
        taskNumber: task.taskNumber || undefined,
        priority: task.priority || undefined,
        status: task.status,
        archivedAt: task.archivedAt,
      });
    }
  }

  if (type === "all" || type === "projects") {
    const projectRelevanceScore = sql<number>`
      CASE
        WHEN LOWER(${projectTable.name}) LIKE ${searchPattern} THEN 3
        WHEN LOWER(${projectTable.description}) LIKE ${searchPattern} THEN 2
        ELSE 1
      END
    `;

    const projectQuery = db
      .select({
        id: projectTable.id,
        name: projectTable.name,
        description: projectTable.description,
        slug: projectTable.slug,
        workspaceId: projectTable.workspaceId,
        workspaceName: workspaceTable.name,
        createdAt: projectTable.createdAt,
        relevanceScore: projectRelevanceScore.as("relevanceScore"),
      })
      .from(projectTable)
      .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
      .where(
        and(
          workspaceFilter,
          or(
            ilike(projectTable.name, searchPattern),
            ilike(projectTable.description, searchPattern),
          ),
        ),
      )
      .orderBy(desc(projectRelevanceScore), desc(projectTable.createdAt))
      .limit(limit);

    const projects = await projectQuery;

    for (const project of projects) {
      results.push({
        id: project.id,
        type: "project",
        title: project.name,
        description: project.description || undefined,
        projectId: project.id,
        projectSlug: project.slug || undefined,
        workspaceId: project.workspaceId,
        workspaceName: project.workspaceName || undefined,
        createdAt: project.createdAt,
        relevanceScore: project.relevanceScore,
      });
    }
  }

  if (type === "all" || type === "workspaces") {
    const workspaceRelevanceScore = sql<number>`
      CASE
        WHEN LOWER(${workspaceTable.name}) LIKE ${searchPattern} THEN 3
        WHEN LOWER(${workspaceTable.description}) LIKE ${searchPattern} THEN 2
        ELSE 1
      END
    `;

    const workspaceQuery = db
      .select({
        id: workspaceTable.id,
        name: workspaceTable.name,
        description: workspaceTable.description,
        createdAt: workspaceTable.createdAt,
        relevanceScore: workspaceRelevanceScore.as("relevanceScore"),
      })
      .from(workspaceTable)
      .where(
        and(
          inArray(workspaceTable.id, accessibleWorkspaceIds),
          workspaceId ? eq(workspaceTable.id, workspaceId) : undefined,
          or(
            ilike(workspaceTable.name, searchPattern),
            ilike(workspaceTable.description, searchPattern),
          ),
        ),
      )
      .orderBy(desc(workspaceRelevanceScore), desc(workspaceTable.createdAt))
      .limit(limit);

    const workspaces = await workspaceQuery;

    for (const workspace of workspaces) {
      results.push({
        id: workspace.id,
        type: "workspace",
        title: workspace.name,
        description: workspace.description || undefined,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        createdAt: workspace.createdAt,
        relevanceScore: workspace.relevanceScore,
      });
    }
  }

  if (type === "all" || type === "comments" || type === "activities") {
    const searchableActivityText = sql<string>`COALESCE(${activityTable.content}, CAST(${activityTable.eventData} AS text), '')`;
    const activityFts = fts
      ? ftsMatch(bodyVector(activityTable.content), fts)
      : null;
    const activityRelevanceScore = activityFts
      ? activityFts.score(2)
      : sql<number>`
      CASE
        WHEN LOWER(${searchableActivityText}) LIKE ${searchPattern} THEN 2
        WHEN LOWER(${taskTable.title}) LIKE ${searchPattern} THEN 1
        ELSE 1
      END
    `;

    const activityQuery = db
      .select({
        id: activityTable.id,
        type: activityTable.type,
        content: activityTable.content,
        eventData: activityTable.eventData,
        taskId: activityTable.taskId,
        taskTitle: taskTable.title,
        taskNumber: taskTable.number,
        projectId: projectTable.id,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        workspaceId: projectTable.workspaceId,
        workspaceName: workspaceTable.name,
        userId: activityTable.userId,
        userName: userTable.name,
        createdAt: activityTable.createdAt,
        relevanceScore: activityRelevanceScore.as("relevanceScore"),
      })
      .from(activityTable)
      .leftJoin(taskTable, eq(activityTable.taskId, taskTable.id))
      .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
      .leftJoin(userTable, eq(activityTable.userId, userTable.id))
      .where(
        and(
          workspaceFilter,
          projectId ? eq(taskTable.projectId, projectId) : undefined,
          activityFts?.match ??
            or(
              ilike(searchableActivityText, searchPattern),
              ilike(taskTable.title, searchPattern),
            ),
          type === "comments" ? eq(activityTable.type, "comment") : undefined,
        ),
      )
      .orderBy(desc(activityRelevanceScore), desc(activityTable.createdAt))
      .limit(limit);

    const activities = await activityQuery;

    for (const activity of activities) {
      const isComment = activity.type === "comment";
      const activityContent = getActivitySearchContent(
        activity.type,
        activity.content,
        activity.eventData,
      );
      results.push({
        id: activity.id,
        type: isComment ? "comment" : "activity",
        title: isComment
          ? `Comment on ${activity.taskTitle || "task"}`
          : `${activity.type} on ${activity.taskTitle || "task"}`,
        content: activityContent,
        projectId: activity.projectId || undefined,
        projectName: activity.projectName || undefined,
        projectSlug: activity.projectSlug || undefined,
        workspaceId: activity.workspaceId || undefined,
        workspaceName: activity.workspaceName || undefined,
        userId: activity.userId || undefined,
        userName: activity.userName || undefined,
        createdAt: activity.createdAt,
        relevanceScore: activity.relevanceScore,
        taskId: activity.taskId,
        taskNumber: activity.taskNumber || undefined,
      });
    }
  }

  if (type === "all" || type === "documents") {
    const docFts = fts
      ? ftsMatch(
          titleBodyVector(documentTable.title, documentTable.content),
          fts,
        )
      : null;
    const docScore = docFts
      ? sql<number>`CASE WHEN ${exactTitle(documentTable.title)} THEN 5 ELSE ${docFts.score(3)} END`
      : sql<number>`CASE WHEN LOWER(${documentTable.title}) LIKE ${searchPattern} THEN 3 ELSE 2 END`;

    const documents = await db
      .select({
        id: documentTable.id,
        title: documentTable.title,
        projectId: projectTable.id,
        projectName: projectTable.name,
        workspaceId: documentTable.workspaceId,
        workspaceName: workspaceTable.name,
        userId: documentTable.creatorId,
        createdAt: documentTable.createdAt,
        status: documentTable.status,
        topicName: topicTable.name,
        scope: documentTable.scope,
        parentName: documentParentName(resolvedUserId),
        relevanceScore: docScore.as("relevanceScore"),
      })
      .from(documentTable)
      // A topic the searcher cannot open stays unnamed, as on the document.
      .leftJoin(
        topicTable,
        and(
          eq(topicTable.id, documentTable.topicId),
          topicAccess(resolvedUserId, topicTable.id),
        ),
      )
      .leftJoin(
        workspaceTable,
        eq(documentTable.workspaceId, workspaceTable.id),
      )
      // A document shared by name can sit in a team the searcher cannot
      // enter; that team stays unnamed.
      .leftJoin(
        projectTable,
        and(
          eq(documentTable.projectId, projectTable.id),
          projectAccessCondition(resolvedUserId, projectTable.id),
        ),
      )
      .where(
        and(
          workspaceId
            ? eq(documentTable.workspaceId, workspaceId)
            : inArray(documentTable.workspaceId, accessibleWorkspaceIds),
          isNull(documentTable.deletedAt),
          documentVisibility(resolvedUserId, {
            id: documentTable.id,
            creatorId: documentTable.creatorId,
            scope: documentTable.scope,
            projectId: documentTable.projectId,
            workProjectId: documentTable.workProjectId,
            taskId: documentTable.taskId,
          }),
          projectId ? eq(projectTable.id, projectId) : undefined,
          docFts?.match ??
            or(
              ilike(documentTable.title, searchPattern),
              ilike(documentTable.content, searchPattern),
            ),
        ),
      )
      // Current documents first, so the limit never cuts one for a draft.
      .orderBy(
        desc(sql`${documentTable.status} = 'current'`),
        desc(docScore),
        desc(documentTable.createdAt),
      )
      .limit(limit);

    for (const doc of documents) {
      results.push({
        id: doc.id,
        type: "document",
        title: doc.title,
        projectId: doc.projectId || undefined,
        projectName: doc.projectName || undefined,
        workspaceId: doc.workspaceId,
        workspaceName: doc.workspaceName || undefined,
        userId: doc.userId || undefined,
        createdAt: doc.createdAt,
        relevanceScore: doc.relevanceScore,
        status: doc.status,
        topicName: doc.topicName ?? undefined,
        scope: doc.scope,
        parentName: doc.parentName,
      });
    }
  }

  // Chat and people sit outside projects, so a project-scoped search skips them.
  if (workspaceId && !projectId) {
    if (type === "all" || type === "messages")
      results.push(
        ...(await searchMessages({
          query,
          fts,
          userId: resolvedUserId,
          workspaceId,
          limit,
        })),
      );
    if (type === "all" || type === "people")
      results.push(...(await searchPeople({ query, workspaceId, limit })));
  }

  results.sort((a, b) => {
    if (a.relevanceScore !== b.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  // Among the documents, the current ones lead: they are what a reader can
  // rely on. Every other result keeps the place its score gave it.
  const documents = results
    .filter((result) => result.type === "document")
    .sort(
      (a, b) => Number(b.status === "current") - Number(a.status === "current"),
    );
  const ordered = results.map((result) =>
    result.type === "document" ? (documents.shift() ?? result) : result,
  );

  const finalResults =
    type === "all" ? pickAcrossTypes(ordered, limit) : ordered.slice(0, limit);

  return {
    results: finalResults,
    totalCount: results.length,
    searchQuery: query,
  };
}

export default globalSearch;
