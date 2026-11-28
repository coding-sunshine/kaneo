import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AgentProposal } from "@/fetchers/agent/proposals";
import { ThreadTicketDialog } from "./thread-ticket-dialog";

const m = vi.hoisted(() => ({
  mutate: vi.fn(),
  isError: false,
  error: null as Error | null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/mutations/agent/use-thread-ticket", () => ({
  useThreadTicket: () => ({
    mutate: m.mutate,
    reset: vi.fn(),
    isError: m.isError,
    error: m.error,
  }),
}));
vi.mock("@/components/agent/agent-proposal-card", () => ({
  AgentProposalCard: ({ proposal }: { proposal: AgentProposal }) => (
    <p>card {proposal.diff.map((change) => change.to).join(" | ")}</p>
  ),
}));

const card = {
  id: "p1",
  tool: "create_ticket_from_thread",
  status: "pending",
  diff: [
    { field: "title", from: null, to: "EU cards fail" },
    { field: "assignee", from: null, to: "Dana" },
  ],
} as unknown as AgentProposal;

const renderDialog = () =>
  render(
    <ThreadTicketDialog
      open
      onOpenChange={vi.fn()}
      workspaceId="w1"
      channelId="c1"
      messageId="m1"
    />,
  );

afterEach(() => {
  cleanup();
  m.mutate.mockReset();
  m.isError = false;
  m.error = null;
});

describe("ThreadTicketDialog", () => {
  it("drafts the ticket for the message and shows the card", async () => {
    m.mutate.mockImplementation(
      (_id: string, options: { onSuccess: (p: AgentProposal) => void }) =>
        options.onSuccess(card),
    );
    renderDialog();
    expect(m.mutate).toHaveBeenCalledWith("m1", expect.anything());
    expect(await screen.findByText("card EU cards fail | Dana")).toBeTruthy();
  });

  it("says why no card came back", () => {
    m.isError = true;
    m.error = new Error("The model did not suggest a ticket");
    renderDialog();
    expect(screen.getByRole("alert").textContent).toBe(
      "The model did not suggest a ticket",
    );
  });
});
