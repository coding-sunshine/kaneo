import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

/** Tells the document's other readers that you are typing in it. */
export async function announceDocumentEditing(workspaceId: string, id: string) {
  const response = await client.document.workspace[":workspaceId"][
    ":id"
  ].editing.$post({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
