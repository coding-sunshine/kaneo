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

vi.mock("@/components/agent/proposal-ticket-fields", () => ({
  ProposalTicketFields: ({
    onChange,
  }: {
    onChange: (fieldId: string, value: string) => void;
  }) => (
    <button type="button" onClick={() => onChange("f1", "Software")}>
      pick Software
    </button>
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
  selectable: false,
  sources: [
    { kind: "task", restricted: false, id: "t1", title: "Login fails" },
  ],
  decidedAt: null,
  result: status === "failed" ? '{"error":"Forbidden"}' : null,
  needsFields: null,
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

  it("applies only the fields left ticked on a selectable card, with each field's reason", () => {
    const triage: AgentProposal = {
      ...proposal("pending"),
      tool: "triage_task",
      selectable: true,
      diff: [
        {
          field: "priority",
          from: "low",
          to: "high",
          reason: "Nobody can sign in",
        },
        { field: "labels", from: null, to: "Bug", reason: "Safari only" },
      ],
    };
    render(
      <AgentProposalCard workspaceId="w1" taskId="t1" proposal={triage} />,
    );
    expect(screen.getByText("Nobody can sign in")).toBeTruthy();
    expect(screen.getByText("Safari only")).toBeTruthy();
    const [priority] = screen.getAllByRole("checkbox");
    fireEvent.click(priority as HTMLElement);
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:agent.proposal.accept" }),
    );
    expect(m.mutate).toHaveBeenCalledWith(
      { proposalId: "p1", decision: "accept", fields: ["labels"] },
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

  it("asks for the team's required fields and accepts with their values", () => {
    render(
      <AgentProposalCard
        workspaceId="w1"
        proposal={{
          ...proposal("pending"),
          tool: "create_ticket_from_thread",
          needsFields: { projectId: "team1", fieldIds: ["f1"] },
        }}
      />,
    );
    const accept = screen.getByText("navigation:agent.proposal.accept");
    expect(accept.closest("button")?.disabled).toBe(true);
    fireEvent.click(screen.getByText("pick Software"));
    expect(accept.closest("button")?.disabled).toBe(false);
    fireEvent.click(accept);
    expect(m.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "accept",
        customFields: [{ fieldId: "f1", value: "Software" }],
      }),
      expect.anything(),
    );
  });
});
