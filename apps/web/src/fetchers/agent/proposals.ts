import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function decideProposal(
  workspaceId: string,
  proposalId: string,
  decision: "accept" | "decline",
) {
  const route = client.agent.workspace[":workspaceId"].proposals[":proposalId"];
  const param = { workspaceId, proposalId };
  const response =
    decision === "accept"
      ? await route.accept.$post({ param })
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
