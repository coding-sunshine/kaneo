import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type FigmaPreview = InferResponseType<
  (typeof client)["figma"]["preview"]["$get"],
  200
>;

export default async function getFigmaPreview(query: {
  workspaceId: string;
  url: string;
}) {
  const response = await client.figma.preview.$get({ query });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
