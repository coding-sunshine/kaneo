import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function deleteIssueTemplate({ id }: { id: string }) {
  const response = await client["issue-template"][":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default deleteIssueTemplate;
