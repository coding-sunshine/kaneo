import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const files = client["file-library"].workspace[":workspaceId"].files;

export async function getFiles(workspaceId: string, q?: string) {
  const response = await files.$get({
    param: { workspaceId },
    query: q ? { q } : {},
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type LibraryFile = Awaited<ReturnType<typeof getFiles>>[number];
