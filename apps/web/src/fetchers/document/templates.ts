import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const api = client["document-template"].workspace[":workspaceId"];

export async function getDocumentTemplates(workspaceId: string) {
  const response = await api.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type DocumentTemplate = Awaited<
  ReturnType<typeof getDocumentTemplates>
>[number];

export async function saveDocumentTemplate(
  workspaceId: string,
  documentId: string,
) {
  const response = await api.$post({
    param: { workspaceId },
    json: { documentId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteDocumentTemplate(workspaceId: string, id: string) {
  const response = await api[":id"].$delete({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
