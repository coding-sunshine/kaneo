import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function listTaskAttachments(taskId: string) {
  const response = await client.task.attachments[":id"].$get({
    param: { id: taskId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteTaskAttachment(taskId: string, assetId: string) {
  const response = await client.task.attachments[":id"][":assetId"].$delete({
    param: { id: taskId, assetId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
