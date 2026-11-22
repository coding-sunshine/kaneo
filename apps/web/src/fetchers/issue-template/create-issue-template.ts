import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type CreateIssueTemplateRequest = InferRequestType<
  (typeof client)["issue-template"]["$post"]
>["json"];

async function createIssueTemplate(json: CreateIssueTemplateRequest) {
  const response = await client["issue-template"].$post({ json });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createIssueTemplate;
