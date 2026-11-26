import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const api = client.topic.workspace[":workspaceId"];
const slots = api[":id"].slots;
const flagged = api["needs-review"];

/** What the topic states now for each fact it tracks. Null when the topic cannot be opened. */
export async function getTopicFacts(workspaceId: string, id: string) {
  const response = await api.current.$get({
    param: { workspaceId },
    query: { topic: id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  const { topics } = await response.json();
  return topics.find((topic) => topic.id === id) ?? null;
}

export type TopicFacts = NonNullable<Awaited<ReturnType<typeof getTopicFacts>>>;
export type TopicFact = TopicFacts["answers"][number];

/** The facts a topic tracks, with the ids that removing one needs. */
export async function getTrackedFacts(workspaceId: string, id: string) {
  const response = await slots.$get({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type TrackedFact = Awaited<ReturnType<typeof getTrackedFacts>>[number];
export type FactType = TrackedFact["type"];

export async function trackFact({
  workspaceId,
  id,
  ...json
}: {
  workspaceId: string;
  id: string;
  name: string;
  type: FactType;
  options?: string[];
}) {
  const response = await slots.$post({ param: { workspaceId, id }, json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function untrackFact(param: {
  workspaceId: string;
  id: string;
  slotId: string;
}) {
  const response = await slots[":slotId"].$delete({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
}

/** The issues and documents that rely on a value of this topic. */
export async function getTopicDependents(workspaceId: string, id: string) {
  const response = await api[":id"].dependents.$get({
    param: { workspaceId, id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return (await response.json()).items;
}

export type TopicDependent = Awaited<
  ReturnType<typeof getTopicDependents>
>[number];

/** Work that rests on a value its topic has since replaced. */
export async function getNeedsReview(workspaceId: string) {
  const response = await flagged.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return (await response.json()).items;
}

export type NeedsReviewItem = Awaited<
  ReturnType<typeof getNeedsReview>
>[number];

export async function clearNeedsReview(param: {
  workspaceId: string;
  dependencyId: string;
}) {
  const response = await flagged[":dependencyId"].clear.$post({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
