import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { CreateInitiativeUpdateInput } from "./types";

export async function getInitiativeUpdates(id: string) {
  const response = await client.initiative[":id"].update.$get({
    param: { id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function createInitiativeUpdate(
  id: string,
  json: CreateInitiativeUpdateInput,
) {
  const response = await client.initiative[":id"].update.$post({
    param: { id },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteInitiativeUpdate(id: string) {
  const response = await client.initiative.update[":id"].$delete({
    param: { id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getWorkspaceInitiativeUpdates(workspaceId: string) {
  const response = await client.initiative.workspace[
    ":workspaceId"
  ].updates.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
