import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function deleteWorkProject(id: string) {
  const response = await client["work-project"][":id"].$delete({
    param: { id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default deleteWorkProject;
