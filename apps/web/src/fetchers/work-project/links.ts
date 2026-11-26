import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

type Api = (typeof client)["work-project"];
export type AddWorkProjectLinkInput = InferRequestType<
  Api[":id"]["link"]["$post"]
>["json"];

export async function addWorkProjectLink(
  workProjectId: string,
  json: AddWorkProjectLinkInput,
) {
  const response = await client["work-project"][":id"].link.$post({
    param: { id: workProjectId },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function removeWorkProjectLink(
  workProjectId: string,
  linkId: string,
) {
  const response = await client["work-project"][":id"].link[":linkId"].$delete({
    param: { id: workProjectId, linkId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
