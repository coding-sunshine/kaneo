import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

type Api = (typeof client)["work-project"];
export type CreateMilestoneInput = InferRequestType<
  Api[":id"]["milestone"]["$post"]
>["json"];
export type UpdateMilestoneInput = InferRequestType<
  Api["milestone"][":id"]["$put"]
>["json"];

export async function createMilestone(
  workProjectId: string,
  json: CreateMilestoneInput,
) {
  const response = await client["work-project"][":id"].milestone.$post({
    param: { id: workProjectId },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function updateMilestone(id: string, json: UpdateMilestoneInput) {
  const response = await client["work-project"].milestone[":id"].$put({
    param: { id },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteMilestone(id: string) {
  const response = await client["work-project"].milestone[":id"].$delete({
    param: { id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
