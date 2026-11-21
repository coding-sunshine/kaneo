import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getWorkProject(id: string) {
  const response = await client["work-project"][":id"].$get({ param: { id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default getWorkProject;
