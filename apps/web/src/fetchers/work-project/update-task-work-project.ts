import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function updateTaskWorkProject(
  taskId: string,
  workProjectId: string | null,
  workProjectMilestoneId: string | null = null,
) {
  const response = await client.task["work-project"][":id"].$put({
    param: { id: taskId },
    json: { workProjectId, workProjectMilestoneId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default updateTaskWorkProject;
