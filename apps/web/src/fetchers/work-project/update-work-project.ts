import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { UpdateWorkProjectInput } from "./types";

async function updateWorkProject(id: string, json: UpdateWorkProjectInput) {
  const response = await client["work-project"][":id"].$put({
    param: { id },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default updateWorkProject;
