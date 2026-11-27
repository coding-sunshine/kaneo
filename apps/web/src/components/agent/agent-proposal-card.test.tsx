import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AgentProposal } from "@/fetchers/agent/proposals";
import { AgentProposalCard } from "./agent-proposal-card";

const m = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/agent/use-decide-proposal", () => ({
  useDecideProposal: () => ({ mutate: m.mutate, isPending: false }),
}));
vi.mock("@/components/agent/agent-source-chip", () => ({
  AgentSourceChip: ({ citation }: { citation: { title?: string } }) => (
    <span>{citation.title}</span>
  ),
}));

const proposal = (status: AgentProposal["status"]): AgentProposal => ({
  id: "p1",
  toolCallId: "call-1",
  tool: "change_task",
  taskId: "t1",
  status,
  diff: [
    { field: "priority", from: "low", to: "high" },
    { field: "labels", from: null, to: "bug" },
  ],
  reason: "It blocks every login",
  sources: [
    { kind: "task", restricted: false, id: "t1", title: "Login fails" },
  ],
  decidedAt: null,
  result: status === "failed" ? '{"error":"Forbidden"}' : null,
});

afterEach(() => {
  cleanup();
  m.mutate.mockReset();
});

describe("AgentProposalCard", () => {
  it("shows the field diff, reason and sources of a pending proposal", () => {
    render(
      <AgentProposalCard
        workspaceId="w1"
        chatId="c1"
        proposal={proposal("pending")}
      />,
    );
    expect(
      screen.getByText("navigation:agent.proposal.fields.priority"),
    ).toBeTruthy();
    expect(screen.getByText("low")).toBeTruthy();
    expect(screen.getByText("high")).toBeTruthy();
    expect(screen.getByText("bug")).toBeTruthy();
    expect(screen.getByText("It blocks every login")).toBeTruthy();
    expect(screen.getByText("Login fails")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "navigation:agent.proposal.accept" }),
    );
    expect(m.mutate).toHaveBeenCalledWith(
      { proposalId: "p1", decision: "accept" },
      expect.anything(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:agent.proposal.decline" }),
    );
    expect(m.mutate).toHaveBeenLastCalledWith(
      { proposalId: "p1", decision: "decline" },
      expect.anything(),
    );
  });

  it("shows the decision instead of the buttons once decided", () => {
    render(
      <AgentProposalCard
        workspaceId="w1"
        chatId="c1"
        proposal={proposal("accepted")}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.getByText("navigation:agent.proposal.status.accepted"),
    ).toBeTruthy();
  });

  it("shows why a proposal could not be applied", () => {
    render(
      <AgentProposalCard
        workspaceId="w1"
        chatId="c1"
        proposal={proposal("failed")}
      />,
    );
    expect(screen.getByText('{"error":"Forbidden"}')).toBeTruthy();
  });
});
