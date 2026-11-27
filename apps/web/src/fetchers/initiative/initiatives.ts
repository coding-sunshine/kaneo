import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { CreateInitiativeInput, UpdateInitiativeInput } from "./types";

export async function getInitiatives(workspaceId: string) {
  const response = await client.initiative.workspace[":workspaceId"].$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getInitiative(id: string) {
  const response = await client.initiative[":id"].$get({ param: { id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function createInitiative(json: CreateInitiativeInput) {
  const response = await client.initiative.$post({ json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function updateInitiative(
  id: string,
  json: UpdateInitiativeInput,
) {
  const response = await client.initiative[":id"].$put({
    param: { id },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteInitiative(id: string) {
  const response = await client.initiative[":id"].$delete({ param: { id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
