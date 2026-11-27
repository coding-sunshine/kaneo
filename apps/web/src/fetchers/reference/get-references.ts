import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type Reference = InferResponseType<
  (typeof client)["reference"]["task"][":taskId"]["$get"],
  200
>["references"][number];

/** What a "Mentioned in" list is about: a ticket, a team or a document. */
export type ReferenceTarget =
  | { kind: "task"; taskId: string }
  | { kind: "project"; projectId: string }
  | { kind: "document"; workspaceId: string; documentId: string };

export async function getReferences(target: ReferenceTarget) {
  const response =
    target.kind === "task"
      ? await client.reference.task[":taskId"].$get({
          param: { taskId: target.taskId },
        })
      : target.kind === "project"
        ? await client.reference.project[":projectId"].$get({
            param: { projectId: target.projectId },
          })
        : await client.reference.workspace[":workspaceId"].document[
            ":documentId"
          ].$get({
            param: {
              workspaceId: target.workspaceId,
              documentId: target.documentId,
            },
          });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
