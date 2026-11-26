import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const one = client.document.workspace[":workspaceId"][":id"];
const stated = one.statements[":statementId"];

type InDocument = { workspaceId: string; id: string };
type OneFact = InDocument & { statementId: string };

/** What the document says about the facts its topic tracks, rejected ones included. */
export async function getDocumentFacts(workspaceId: string, id: string) {
  const response = await one.statements.$get({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type DocumentFact = Awaited<ReturnType<typeof getDocumentFacts>>[number];

export async function addDocumentFact({
  workspaceId,
  id,
  ...json
}: InDocument & { slot: string; value: string; quote: string }) {
  const response = await one.statements.$post({
    param: { workspaceId, id },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function confirmDocumentFact(param: OneFact) {
  const response = await stated.confirm.$post({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function rejectDocumentFact({
  reason,
  ...param
}: OneFact & { reason: string }) {
  const response = await stated.reject.$post({ param, json: { reason } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** The document's facts sorted against what its topic states now. */
export async function getDocumentReceipt(workspaceId: string, id: string) {
  const response = await one.receipt.$get({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type DocumentReceipt = Awaited<ReturnType<typeof getDocumentReceipt>>;
export type FactConflict = DocumentReceipt["conflicts"][number];
export type ComparedFact = DocumentReceipt["repeats"][number];
export type StatedFact = DocumentReceipt["new"][number];
export type MissingFact = DocumentReceipt["notChecked"][number];

export type ConflictDecision = "replace" | "keep" | "tolerate" | "dismiss";

export async function decideDocumentConflict({
  workspaceId,
  id,
  conflictId,
  ...json
}: InDocument & {
  conflictId: string;
  decision: ConflictDecision;
  reason: string;
  tolerateUntil?: string;
}) {
  const response = await one.conflicts[":conflictId"].decide.$post({
    param: { workspaceId, id, conflictId },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** Says an issue relies on a value the topic states now. */
export async function addFactDependent({
  taskId,
  ...param
}: OneFact & { taskId: string }) {
  const response = await stated.dependents.$put({ param, json: { taskId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function removeFactDependent(
  param: OneFact & { dependencyId: string },
) {
  const response = await stated.dependents[":dependencyId"].$delete({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
}
