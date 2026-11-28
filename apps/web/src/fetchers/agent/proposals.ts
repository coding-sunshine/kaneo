import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function decideProposal(
  workspaceId: string,
  proposalId: string,
  decision: "accept" | "decline",
  /** On a selectable proposal: only these fields are applied. */
  fields?: string[],
  /** On a ticket from a thread: values for its team's required fields. */
  customFields?: { fieldId: string; value: string }[],
) {
  const route = client.agent.workspace[":workspaceId"].proposals[":proposalId"];
  const param = { workspaceId, proposalId };
  const response =
    decision === "accept"
      ? await route.accept.$post({
          param,
          query: {
            ...(fields ? { fields: fields.join(",") } : {}),
            ...(customFields
              ? { customFields: JSON.stringify(customFields) }
              : {}),
          },
        })
      : await route.decline.$post({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getAiAudit(workspaceId: string) {
  const response = await client.agent.workspace[":workspaceId"].audit.$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type AgentProposal = Awaited<ReturnType<typeof decideProposal>>;
export type AiAuditRow = Awaited<ReturnType<typeof getAiAudit>>[number];

export async function getAgentDrafts(workspaceId: string) {
  const response = await client.agent.workspace[
    ":workspaceId"
  ].proposals.drafts.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getTaskProposals(workspaceId: string, taskId: string) {
  const response = await client.agent.workspace[":workspaceId"].tasks[
    ":taskId"
  ].proposals.$get({ param: { workspaceId, taskId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
