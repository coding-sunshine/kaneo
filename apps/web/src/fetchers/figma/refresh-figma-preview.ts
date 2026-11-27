import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export default async function refreshFigmaPreview(json: {
  workspaceId: string;
  url: string;
}) {
  const response = await client.figma.preview.refresh.$post({ json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
