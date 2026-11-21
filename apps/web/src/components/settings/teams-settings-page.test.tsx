import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TeamsSettingsPage } from "./teams-settings-page";

const state = vi.hoisted(() => ({
  teams: [] as unknown[],
  canCreate: true,
}));

vi.mock("@tanstack/react-router", () => ({
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
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w1" } }),
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: state.teams }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canCreateProjects: () => state.canCreate }),
}));
vi.mock("@/components/shared/modals/create-project-modal", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">create</div> : null,
}));

afterEach(() => {
  cleanup();
  state.teams = [];
  state.canCreate = true;
});

describe("TeamsSettingsPage", () => {
  it("lists each team linking to its settings", () => {
    state.teams = [
      {
        id: "p1",
        name: "Engineering",
        slug: "ENG",
        icon: "Layout",
        createdAt: "2026-01-02T00:00:00.000Z",
        statistics: { totalTasks: 42 },
      },
    ];
    render(<TeamsSettingsPage />);

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/settings/p1");
    expect(link.textContent).toContain("Engineering");
    expect(screen.getByText("ENG")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("opens the create dialog only for people who can create teams", () => {
    render(<TeamsSettingsPage />);
    expect(screen.getByText("settings:teams.empty")).toBeTruthy();
    fireEvent.click(screen.getByText("settings:teams.create"));
    expect(screen.getByRole("dialog")).toBeTruthy();

    cleanup();
    state.canCreate = false;
    render(<TeamsSettingsPage />);
    expect(screen.queryByText("settings:teams.create")).toBeNull();
  });
});
