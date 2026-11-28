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

const setting = client["semantic-search"].workspace[":workspaceId"].setting;

export async function getSemanticSearchSetting(workspaceId: string) {
  const response = await setting.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function setSemanticSearchSetting(
  workspaceId: string,
  enabled: boolean,
) {
  const response = await setting.$put({
    param: { workspaceId },
    json: { enabled },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
