import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type DocumentExportFormat = "markdown" | "pdf";

export async function exportDocument(
  workspaceId: string,
  id: string,
  format: DocumentExportFormat,
) {
  const response = await client.document.workspace[":workspaceId"][
    ":id"
  ].export.$get({
    param: { workspaceId, id },
    query: { format },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.blob();
}
