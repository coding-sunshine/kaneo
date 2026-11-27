import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function addWorkProjectDependency(
  id: string,
  dependsOnId: string,
) {
  const response = await client["work-project"][":id"].dependency.$post({
    param: { id },
    json: { dependsOnId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function removeWorkProjectDependency(
  id: string,
  dependsOnId: string,
) {
  const response = await client["work-project"][":id"].dependency[
    ":dependsOnId"
  ].$delete({ param: { id, dependsOnId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
