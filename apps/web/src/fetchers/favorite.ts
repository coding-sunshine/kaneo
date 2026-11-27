import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type FavoriteTarget = {
  type: "project" | "view" | "document" | "pullRequest" | "documentPin";
  targetId: string;
};

export async function getFavorites(workspaceId: string) {
  const response = await client.favorite.workspace[":workspaceId"].$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function setFavorite(
  workspaceId: string,
  target: FavoriteTarget,
  on: boolean,
) {
  const param = { workspaceId };
  const response = on
    ? await client.favorite.workspace[":workspaceId"].$put({
        param,
        json: target,
      })
    : await client.favorite.workspace[":workspaceId"].$delete({
        param,
        query: target,
      });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
