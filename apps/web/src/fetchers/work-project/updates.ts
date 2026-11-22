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
