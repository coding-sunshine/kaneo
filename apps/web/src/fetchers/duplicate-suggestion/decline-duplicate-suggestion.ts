import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function declineDuplicateSuggestion({
  taskId,
  otherTaskId,
}: {
  taskId: string;
  otherTaskId: string;
}) {
  const response = await client["duplicate-suggestion"].task[
    ":taskId"
  ].decline.$post({ param: { taskId }, json: { otherTaskId } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default declineDuplicateSuggestion;
