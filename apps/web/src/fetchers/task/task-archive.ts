import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function listArchivedTasks(projectId: string) {
  const response = await client.task.archived[":projectId"].$get({
    param: { projectId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function unarchiveTask(taskId: string) {
  const response = await client.task.unarchive[":id"].$put({
    param: { id: taskId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
