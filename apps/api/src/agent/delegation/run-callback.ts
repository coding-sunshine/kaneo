import { and, asc, eq } from "drizzle-orm";
import type { Context } from "hono";
import db from "../../database";
import {
  codingAgentRunTable,
  columnTable,
  externalLinkTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import updateTaskStatus from "../../task/controllers/update-task-status";
import { codingAgentConfig } from "./coding-agent-config";
import { callbackBody } from "./delegation-schema";
import { tokenMatches } from "./run-token";

type Run = typeof codingAgentRunTable.$inferSelect;
type Task = { id: string; projectId: string; status: string };

const notFound = (c: Context) => c.json({ message: "Not found" }, 404);

async function linkPullRequest(
  run: Run,
  task: Task,
  url: string,
  title?: string,
) {
  const [existing] = await db
    .select({ id: externalLinkTable.id })
    .from(externalLinkTable)
    .where(
      and(
        eq(externalLinkTable.taskId, task.id),
        eq(externalLinkTable.resourceType, "pull_request"),
        eq(externalLinkTable.url, url),
      ),
    );
  if (!existing) {
    await db.insert(externalLinkTable).values({
      taskId: task.id,
      integrationId: null,
      resourceType: "pull_request",
      externalId: url,
      url,
      title: title || null,
      metadata: JSON.stringify({
        state: "open",
        merged: false,
        author: run.agent,
      }),
    });
  }
  await db
    .update(codingAgentRunTable)
    .set({ status: "pr_opened", pullRequestUrl: url })
    .where(eq(codingAgentRunTable.id, run.id));
}

// The merge closes the link and moves the ticket to the team's first final
// column, as the person who delegated it.
async function echoMerge(run: Run, task: Task) {
  let title: string | null = null;
  if (run.pullRequestUrl) {
    const [link] = await db
      .update(externalLinkTable)
      .set({
        metadata: JSON.stringify({
          state: "closed",
          merged: true,
          author: run.agent,
        }),
      })
      .where(
        and(
          eq(externalLinkTable.taskId, task.id),
          eq(externalLinkTable.resourceType, "pull_request"),
          eq(externalLinkTable.url, run.pullRequestUrl),
        ),
      )
      .returning({ title: externalLinkTable.title });
    title = link?.title ?? null;
  }
  const [done] = await db
    .select({ slug: columnTable.slug })
    .from(columnTable)
    .where(
      and(
        eq(columnTable.projectId, task.projectId),
        eq(columnTable.isFinal, true),
      ),
    )
    .orderBy(asc(columnTable.position))
    .limit(1);
  if (done && run.requestedBy && task.status !== done.slug) {
    await updateTaskStatus({
      id: task.id,
      status: done.slug,
      currentUserId: run.requestedBy,
    });
  }
  await db
    .update(codingAgentRunTable)
    .set({ status: "merged" })
    .where(eq(codingAgentRunTable.id, run.id));
  if (run.pullRequestUrl) {
    await publishEvent("pull_request.merged", {
      taskId: task.id,
      projectId: task.projectId,
      url: run.pullRequestUrl,
      title: title ?? run.pullRequestUrl,
      body: null,
    });
  }
}

/**
 * Where the coding agent reports on a run. It answers only to the run's own
 * token; any other caller, or a run that does not exist, gets 404.
 */
export async function handleCodingAgentCallback(c: Context) {
  const token = (c.req.header("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const [run] = await db
    .select()
    .from(codingAgentRunTable)
    .where(eq(codingAgentRunTable.id, c.req.param("runId") ?? ""));
  if (
    !codingAgentConfig() ||
    !run ||
    !token ||
    !tokenMatches(token, run.tokenHash)
  )
    return notFound(c);
  const parsed = callbackBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json({ message: "Invalid event", code: "BAD_REQUEST" }, 400);
  const [task] = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      status: taskTable.status,
    })
    .from(taskTable)
    .where(eq(taskTable.id, run.taskId));
  if (!task) return notFound(c);

  const event = parsed.data;
  if (event.type === "pull_request.opened") {
    await linkPullRequest(
      run,
      task,
      event.pullRequest.url,
      event.pullRequest.title,
    );
  } else if (event.type === "pull_request.merged") {
    await echoMerge(run, task);
  } else if (event.type === "failed") {
    await db
      .update(codingAgentRunTable)
      .set({ status: "failed", error: event.message ?? "The run failed" })
      .where(eq(codingAgentRunTable.id, run.id));
  }
  await publishEvent("task.updated", {
    taskId: task.id,
    projectId: task.projectId,
  });
  return c.json({ ok: true }, 200);
}
