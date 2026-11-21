import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { SavedViewInput } from "@/lib/saved-view";

export async function getViews(workspaceId: string) {
  const response = await client.view.workspace[":workspaceId"].$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function createView(input: SavedViewInput) {
  const response = await client.view.$post({ json: input });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteView(workspaceId: string, id: string) {
  const response = await client.view.workspace[":workspaceId"][":id"].$delete({
    param: { workspaceId, id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
