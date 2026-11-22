import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function deleteWorkspaceWebhook(id: string) {
  const response = await client["workspace-webhook"][":id"].$delete({
    param: { id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
