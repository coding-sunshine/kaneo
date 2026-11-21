import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { CreateWorkProjectInput } from "./types";

async function createWorkProject(json: CreateWorkProjectInput) {
  const response = await client["work-project"].$post({ json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default createWorkProject;
