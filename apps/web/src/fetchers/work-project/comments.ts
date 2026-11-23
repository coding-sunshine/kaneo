import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getWorkProjectComments(id: string) {
  const response = await client["work-project"][":id"].comment.$get({
    param: { id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function createWorkProjectComment(id: string, content: string) {
  const response = await client["work-project"][":id"].comment.$post({
    param: { id },
    json: { content },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function editWorkProjectComment(id: string, content: string) {
  const response = await client["work-project"].comment[":id"].$put({
    param: { id },
    json: { content },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteWorkProjectComment(id: string) {
  const response = await client["work-project"].comment[":id"].$delete({
    param: { id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
