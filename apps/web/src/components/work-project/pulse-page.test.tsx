import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { PulsePage } from "./pulse-page";

const getUpdates = vi.fn();
vi.mock("@/fetchers/work-project/updates", () => ({
  getWorkspaceUpdates: (...a: unknown[]) => getUpdates(...a),
  editWorkProjectUpdate: vi.fn(),
  deleteWorkProjectUpdate: vi.fn(),
}));
const getDrafts = vi.fn();
vi.mock("@/fetchers/agent/proposals", () => ({
  getAgentDrafts: (...a: unknown[]) => getDrafts(...a),
  decideProposal: vi.fn(),
}));
const agent = vi.hoisted(() => ({ on: true }));
vi.mock("@/hooks/queries/agent/use-agent", () => ({
  useHasAgent: () => agent.on,
}));
vi.mock("@/components/agent/agent-proposal-card", () => ({
  AgentProposalCard: ({ proposal }: { proposal: { reason: string } }) => (
    <section aria-label="draft">{proposal.reason}</section>
  ),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "me" } }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ isAdmin: true }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/p">{children}</a>
  ),
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  getDrafts.mockReset().mockResolvedValue([]);
  agent.on = true;
});
getDrafts.mockResolvedValue([]);

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PulsePage workspaceId="w1" />
    </QueryClientProvider>,
  );

describe("PulsePage", () => {
  it("lists updates with their project and no edit controls", async () => {
    getUpdates.mockResolvedValue([
      {
        id: "u1",
        workProjectId: "p1",
        workProjectName: "Roadmap",
        userId: "me",
        userName: "Ann",
        health: "offTrack",
        body: "Behind",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    renderPage();
    expect(await screen.findByText("Roadmap")).toBeTruthy();
    expect(screen.getByText("Behind")).toBeTruthy();
    expect(
      screen.queryByLabelText("workspace:workProject.updates.delete"),
    ).toBeNull();
    expect(getUpdates).toHaveBeenCalledWith("w1");
  });

  it("shows a loop's drafted update to accept, even before any update is posted", async () => {
    getUpdates.mockResolvedValue([]);
    getDrafts.mockResolvedValue([
      {
        id: "d1",
        toolCallId: "c1",
        tool: "create_project_update",
        taskId: null,
        status: "pending",
        diff: [{ field: "update", from: null, to: "Shipped search" }],
        reason: "Weekly summary",
        sources: [],
        decidedAt: null,
        result: null,
      },
    ]);
    renderPage();
    expect(await screen.findByText("Weekly summary")).toBeTruthy();
    expect(getDrafts).toHaveBeenCalledWith("w1");
    expect(
      screen.queryByText("workspace:workProject.updates.pulseEmpty"),
    ).toBeNull();
  });

  it("asks for no drafts without AI", async () => {
    agent.on = false;
    getUpdates.mockResolvedValue([]);
    renderPage();
    await screen.findByText("workspace:workProject.updates.pulseEmpty");
    expect(getDrafts).not.toHaveBeenCalled();
  });

  it("shows the empty state", async () => {
    getUpdates.mockResolvedValue([]);
    renderPage();
    expect(
      await screen.findByText("workspace:workProject.updates.pulseEmpty"),
    ).toBeTruthy();
  });
});
