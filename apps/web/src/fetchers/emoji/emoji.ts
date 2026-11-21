import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getWorkspaceEmoji(workspaceId: string) {
  const response = await client.emoji.workspace[":workspaceId"].$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function createWorkspaceEmoji(
  workspaceId: string,
  name: string,
  file: Blob,
) {
  const route = client.emoji.workspace[":workspaceId"];
  const contentType = file.type as "image/png";
  const uploadResponse = await route.upload.$post({
    param: { workspaceId },
    json: { name, contentType, size: file.size },
  });
  if (!uploadResponse.ok) throw await HttpError.fromResponse(uploadResponse);
  const upload = await uploadResponse.json();

  const storageResponse = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: file,
  });
  if (!storageResponse.ok) throw new Error();

  const response = await route.$post({
    param: { workspaceId },
    json: {
      name,
      key: upload.key,
      version: upload.version,
      contentType,
      size: file.size,
    },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
