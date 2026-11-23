import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const drafts = client["task-draft"].workspace[":workspaceId"];

export type TaskDraft = Awaited<ReturnType<typeof getTaskDrafts>>[number];
export type TaskDraftInput = {
  projectId: string | null;
  title: string;
  description: string;
  properties: Record<string, unknown>;
};

export async function getTaskDrafts(workspaceId: string) {
  const response = await drafts.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** Updates the draft when `id` is given, otherwise saves a new one. */
export async function saveTaskDraft(
  workspaceId: string,
  input: TaskDraftInput,
  id?: string,
) {
  const response = id
    ? await drafts[":id"].$put({
        param: { workspaceId, id },
        json: input,
      })
    : await drafts.$post({ param: { workspaceId }, json: input });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteTaskDraft(workspaceId: string, id: string) {
  const response = await drafts[":id"].$delete({
    param: { workspaceId, id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
