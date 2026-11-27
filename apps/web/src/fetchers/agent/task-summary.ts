import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function summarizeTask(workspaceId: string, taskId: string) {
  const response = await client.agent.workspace[":workspaceId"].tasks[
    ":taskId"
  ].summary.$post({ param: { workspaceId, taskId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type TaskSummary = Awaited<ReturnType<typeof summarizeTask>>;
