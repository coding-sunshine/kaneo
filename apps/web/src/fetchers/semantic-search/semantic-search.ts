import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function semanticSearch(workspaceId: string, query: string) {
  const response = await client["semantic-search"].workspace[
    ":workspaceId"
  ].$post({ param: { workspaceId }, json: { query } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type SemanticSearchResult = Awaited<ReturnType<typeof semanticSearch>>;
