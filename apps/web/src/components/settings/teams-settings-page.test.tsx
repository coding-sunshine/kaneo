import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TeamsSettingsPage } from "./teams-settings-page";

const state = vi.hoisted(() => ({
  teams: [] as unknown[],
  canCreate: true,
  canDelete: true,
  updateMembership: vi.fn(async () => ({})),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({
    children,
    params,
  }: {
    children: ReactNode;
    params: { projectId: string };
  }) => <a href={`/settings/${params.projectId}`}>{children}</a>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w1" } }),
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: state.teams }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateProjects: () => state.canCreate,
    canDeleteProjects: () => state.canDelete,
  }),
}));
vi.mock("@/components/settings/teams/team-members-count", () => ({
  TeamMembersCount: () => "3",
}));
vi.mock("@/fetchers/project/update-team-membership", () => ({
  default: state.updateMembership,
}));
vi.mock("@/components/shared/modals/create-project-modal", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">create</div> : null,
}));

afterEach(() => {
  cleanup();
  state.teams = [];
  state.canCreate = true;
  state.canDelete = true;
  vi.clearAllMocks();
});

const team = (id: string, name: string, joined: boolean) => ({
  id,
  name,
  slug: name.slice(0, 3).toUpperCase(),
  icon: "Layout",
  description: null,
  isPublic: false,
  archivedAt: null,
  createdAt: "2026-01-02T00:00:00.000Z",
  statistics: { totalTasks: 42 },
  membership: { joined },
});

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TeamsSettingsPage />
    </QueryClientProvider>,
  );
}

describe("TeamsSettingsPage", () => {
  it("lists each team linking to its settings", () => {
    state.teams = [team("p1", "Engineering", true)];
    renderPage();

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/settings/p1");
    expect(link.textContent).toContain("Engineering");
    expect(screen.getByText("ENG")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("filters by name", () => {
    state.teams = [team("p1", "Engineering", true), team("p2", "Design", true)];
    renderPage();
    fireEvent.change(
      screen.getByPlaceholderText("settings:teams.filterPlaceholder"),
      { target: { value: "des" } },
    );
    expect(screen.queryByText("Engineering")).toBeNull();
    expect(screen.getByText("Design")).toBeTruthy();
  });

  it("lets someone who left every team join one again", async () => {
    state.teams = [team("p1", "Engineering", false)];
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "settings:teams.openMenu" }),
    );
    expect(
      screen.queryByRole("menuitem", {
        name: "navigation:projectList.leaveTeam",
      }),
    ).toBeNull();
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "navigation:projectList.joinTeam",
      }),
    );
    await waitFor(() =>
      expect(state.updateMembership).toHaveBeenCalledWith("p1", {
        joined: true,
      }),
    );
  });

  it("offers Leave team to members and Delete only with permission", async () => {
    state.teams = [team("p1", "Engineering", true)];
    state.canDelete = false;
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:teams.openMenu" }),
    );
    expect(
      await screen.findByRole("menuitem", {
        name: "navigation:projectList.leaveTeam",
      }),
    ).toBeTruthy();
    expect(screen.queryByText("settings:teams.menuDelete")).toBeNull();
  });

  it("opens the create dialog only for people who can create teams", () => {
    renderPage();
    expect(screen.getByText("settings:teams.empty")).toBeTruthy();
    fireEvent.click(screen.getByText("settings:teams.create"));
    expect(screen.getByRole("dialog")).toBeTruthy();

    cleanup();
    state.canCreate = false;
    renderPage();
    expect(screen.queryByText("settings:teams.create")).toBeNull();
  });
});
