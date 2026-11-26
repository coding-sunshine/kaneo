import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const api = client.topic.workspace[":workspaceId"][":id"]["task-statement"];

export async function getTopicTaskStatements(workspaceId: string, id: string) {
  const response = await api.$get({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type TopicTaskStatement = Awaited<
  ReturnType<typeof getTopicTaskStatements>
>["statements"][number];

export async function setTaskStatementDismissed(
  param: { workspaceId: string; id: string; factId: string },
  dismissed: boolean,
) {
  const response = dismissed
    ? await api[":factId"].dismissed.$put({ param })
    : await api[":factId"].dismissed.$delete({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
