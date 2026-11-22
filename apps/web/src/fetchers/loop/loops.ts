import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

import type { LoopAction } from "@/components/loops/loop-templates";

export type LoopInput = {
  name: string;
  instructions: string;
  trigger:
    | "schedule"
    | "task_created"
    | "task_status_changed"
    | "comment_created";
  projectId: string | null;
  actions: LoopAction[];
  frequency: "hourly" | "daily" | "weekly" | "monthly" | "yearly" | null;
};

export async function draftLoop(workspaceId: string, description: string) {
  const response = await client.loop.draft.$post({
    json: { workspaceId, description },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getLoops(workspaceId: string, scope: "mine" | "all") {
  const response = await client.loop.workspace[":workspaceId"].$get({
    param: { workspaceId },
    query: { scope },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function createLoop(workspaceId: string, input: LoopInput) {
  const response = await client.loop.$post({ json: { workspaceId, ...input } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function updateLoop(
  workspaceId: string,
  id: string,
  input: Partial<LoopInput> & { enabled?: boolean },
) {
  const response = await client.loop.workspace[":workspaceId"][":id"].$put({
    param: { workspaceId, id },
    json: input,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteLoop(workspaceId: string, id: string) {
  const response = await client.loop.workspace[":workspaceId"][":id"].$delete({
    param: { workspaceId, id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function runLoop(workspaceId: string, id: string) {
  const response = await client.loop.workspace[":workspaceId"][":id"].run.$post(
    { param: { workspaceId, id } },
  );
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getRuns(workspaceId: string, id: string) {
  const response = await client.loop.workspace[":workspaceId"][":id"].runs.$get(
    { param: { workspaceId, id } },
  );
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getRun(workspaceId: string, id: string, runId: string) {
  const response = await client.loop.workspace[":workspaceId"][":id"].runs[
    ":runId"
  ].$get({ param: { workspaceId, id, runId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
