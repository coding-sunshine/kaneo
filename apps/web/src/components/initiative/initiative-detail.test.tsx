import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { InitiativeDetail } from "./initiative-detail";

const getInitiative = vi.fn();
const updateInitiative = vi.fn();
vi.mock("@/fetchers/initiative/initiatives", () => ({
  getInitiative: (...a: unknown[]) => getInitiative(...a),
  updateInitiative: (...a: unknown[]) => updateInitiative(...a),
  deleteInitiative: vi.fn(),
  createInitiative: vi.fn(),
}));
const createUpdate = vi.fn();
vi.mock("@/fetchers/initiative/updates", () => ({
  getInitiativeUpdates: () => Promise.resolve([]),
  createInitiativeUpdate: (...a: unknown[]) => createUpdate(...a),
  deleteInitiativeUpdate: vi.fn(),
}));
vi.mock("@/fetchers/work-project/get-work-projects", () => ({
  default: () =>
    Promise.resolve([
      { id: "p1", name: "Alpha", health: "atRisk", progress: {} },
      { id: "p3", name: "Gamma", health: null, progress: {} },
    ]),
}));
vi.mock("@/fetchers/workspace-user/get-active-workspace-users", () => ({
  default: () => Promise.resolve({ members: [] }),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "me" } }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    isAdmin: false,
    canUpdateTasks: () => true,
    canUpdateProjects: () => true,
    canDeleteProjects: () => false,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/p">{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const initiative = {
  id: "n1",
  workspaceId: "w1",
  name: "Grow",
  description: null,
  ownerId: null,
  targetDate: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  workProjectIds: ["p1", "p2"],
  health: "onTrack",
  rolledUpHealth: "atRisk",
  progress: { total: 4, done: 1 },
  workProjects: [
    {
      id: "p1",
      name: "Alpha",
      icon: null,
      color: "#000",
      health: "atRisk",
      status: "started",
      progress: { total: 3, done: 1 },
    },
    {
      id: "p2",
      name: "Beta",
      icon: null,
      color: "#000",
      health: null,
      status: "planned",
      progress: { total: 1, done: 0 },
    },
  ],
};

const renderDetail = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <InitiativeDetail workspaceId="w1" initiativeId="n1" />
    </QueryClientProvider>,
  );

describe("InitiativeDetail", () => {
  it("shows rolled-up health, progress and the projects", async () => {
    getInitiative.mockResolvedValue(initiative);
    renderDetail();
    expect(await screen.findByText("Beta")).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(
      screen.getByText(
        'workspace:initiative.detail.progress {"done":1,"total":4}',
        {
          exact: false,
        },
      ),
    ).toBeTruthy();
    const rolledUp = screen.getByLabelText(
      "workspace:initiative.detail.rolledUpHealth",
    );
    expect(rolledUp.textContent).toContain(
      "workspace:workProject.health.atRisk",
    );
    expect(getInitiative).toHaveBeenCalledWith("n1");
  });

  it("detaches a project, keeping the others", async () => {
    getInitiative.mockResolvedValue(initiative);
    updateInitiative.mockResolvedValue(initiative);
    renderDetail();
    fireEvent.click(
      await screen.findByRole("button", {
        name: 'workspace:initiative.projects.remove {"name":"Beta"}',
      }),
    );
    await waitFor(() =>
      expect(updateInitiative).toHaveBeenCalledWith("n1", {
        workProjectIds: ["p1"],
      }),
    );
  });

  it("posts an update with its health", async () => {
    getInitiative.mockResolvedValue(initiative);
    createUpdate.mockResolvedValue({});
    renderDetail();
    fireEvent.change(
      await screen.findByLabelText("workspace:initiative.updates.placeholder"),
      { target: { value: "Going well" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "workspace:initiative.updates.post" }),
    );
    await waitFor(() =>
      expect(createUpdate).toHaveBeenCalledWith("n1", {
        health: "onTrack",
        body: "Going well",
      }),
    );
  });
});
