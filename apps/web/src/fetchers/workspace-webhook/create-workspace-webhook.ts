import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { WorkspaceWebhookValues } from "./webhook-types";

export async function createWorkspaceWebhook(
  json: WorkspaceWebhookValues & { workspaceId: string },
) {
  const response = await client["workspace-webhook"].$post({
    json: json as typeof json & {
      resourceTypes: ("task" | "comment" | "project" | "label" | "cycle")[];
    },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
