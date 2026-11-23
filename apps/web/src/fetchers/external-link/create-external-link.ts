import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type CreateExternalLinkRequest = {
  taskId: string;
  url: string;
  title?: string;
  resourceType?: "url" | "pull_request";
  metadata?: { state: "open" | "closed"; merged: boolean; draft: boolean };
};

async function createExternalLink({
  taskId,
  url,
  title,
  resourceType,
  metadata,
}: CreateExternalLinkRequest) {
  const response = await client["external-link"].task[":taskId"].$post({
    param: { taskId },
    json: {
      url,
      ...(title ? { title } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(metadata ? { metadata } : {}),
    },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createExternalLink;
