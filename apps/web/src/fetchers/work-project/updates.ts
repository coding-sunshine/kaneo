import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type CreateUpdateInput = InferRequestType<
  (typeof client)["work-project"][":id"]["update"]["$post"]
>["json"];

export async function getWorkProjectUpdates(id: string) {
  const response = await client["work-project"][":id"].update.$get({
    param: { id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function createWorkProjectUpdate(
  id: string,
  json: CreateUpdateInput,
) {
  const response = await client["work-project"][":id"].update.$post({
    param: { id },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type EditUpdateInput = InferRequestType<
  (typeof client)["work-project"]["update"][":id"]["$put"]
>["json"];

export async function editWorkProjectUpdate(id: string, json: EditUpdateInput) {
  const response = await client["work-project"].update[":id"].$put({
    param: { id },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteWorkProjectUpdate(id: string) {
  const response = await client["work-project"].update[":id"].$delete({
    param: { id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getWorkspaceUpdates(workspaceId: string) {
  const response = await client["work-project"].workspace[
    ":workspaceId"
  ].updates.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
