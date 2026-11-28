import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const api = client["catch-up"].workspace[":workspaceId"];

export async function catchUp(workspaceId: string, hours: number) {
  const response = await api.$post({ param: { workspaceId }, json: { hours } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getCatchUpPreference(workspaceId: string) {
  const response = await api.preference.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function setCatchUpPreference(
  workspaceId: string,
  includeDirectMessages: boolean,
) {
  const response = await api.preference.$put({
    param: { workspaceId },
    json: { includeDirectMessages },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type CatchUp = Awaited<ReturnType<typeof catchUp>>;
export type CatchUpSource = CatchUp["bullets"][number]["sources"][number];
