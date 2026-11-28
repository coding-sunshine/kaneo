import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

const route = client.agent.workspace[":workspaceId"].writing;

export type WritingAction = InferRequestType<
  (typeof route)["$post"]
>["json"]["action"];

export async function rewriteSelection(
  workspaceId: string,
  action: WritingAction,
  text: string,
) {
  const response = await route.$post({
    param: { workspaceId },
    json: { action, text },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
