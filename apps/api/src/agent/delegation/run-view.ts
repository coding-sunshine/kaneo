import type { codingAgentRunTable } from "../../database/schema";

type Run = typeof codingAgentRunTable.$inferSelect;

/** A run as the ticket shows it; never its token. */
export const runView = (run: Run) => ({
  id: run.id,
  taskId: run.taskId,
  agent: run.agent,
  status: run.status,
  pullRequestUrl: run.pullRequestUrl,
  error: run.error,
  createdAt: run.createdAt,
});
