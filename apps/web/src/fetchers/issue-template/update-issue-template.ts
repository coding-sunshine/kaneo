import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type UpdateIssueTemplateRequest = InferRequestType<
  (typeof client)["issue-template"][":id"]["$put"]
>["json"];

async function updateIssueTemplate({
  id,
  data,
}: {
  id: string;
  data: UpdateIssueTemplateRequest;
}) {
  const response = await client["issue-template"][":id"].$put({
    param: { id },
    json: data,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateIssueTemplate;
