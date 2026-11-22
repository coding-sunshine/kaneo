import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import { TeamMenuItems } from "./team-menu-items";
import { useTeamShortcuts } from "./use-team-actions";

const { mutate, navigate, projects, toggle } = vi.hoisted(() => ({
  mutate: vi.fn(),
  navigate: vi.fn(),
  toggle: vi.fn(),
  projects: { current: [] as unknown[] },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/favorite/use-favorites", () => ({
  useFavorite: () => ({ isFavorite: false, toggle }),
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: projects.current }),
}));
vi.mock("@/hooks/mutations/project/use-update-team-membership", () => ({
  default: () => ({ mutate }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderMenu(joined: boolean, onLeave = vi.fn()) {
  projects.current = [
    {
      id: "p1",
      name: "Engineering",
      membership: {
        joined,
        notifyIssueAdded: true,
        notifyIssueClosed: false,
        notifyIssueTriage: false,
      },
    },
  ];
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <TeamMenuItems workspaceId="w1" projectId="p1" onLeave={onLeave} />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  fireEvent.click(screen.getByRole("button", { name: "open" }));
  return onLeave;
}

function ShortcutHost() {
  useTeamShortcuts("w1", "p1");
  return null;
}

describe("TeamMenuItems", () => {
  it("shows Linear's shortcut hints and the Slack row before Leave team", async () => {
    renderMenu(true);
    const favorite = await screen.findByRole("menuitem", {
      name: /navigation:projectList.favorite/,
    });
    expect(favorite.textContent).toContain("F");
    expect(favorite.querySelectorAll("kbd").length).toBeGreaterThan(1);
    const url = screen.getByRole("menuitem", {
      name: /navigation:projectList.copyUrl/,
    });
    expect(url.textContent).toContain(",");
    const rows = screen
      .getAllByRole("menuitem")
      .map((row) => row.textContent ?? "");
    const slack = rows.findIndex((row) => row.includes("configureSlack"));
    expect(slack).toBe(rows.findIndex((row) => row.includes("subscribe")) + 1);
    expect(rows[slack + 1]).toContain("leaveTeam");
    fireEvent.click(screen.getAllByRole("menuitem")[slack]);
    expect(navigate).toHaveBeenCalledWith({
      to: "/dashboard/settings/projects/$projectId/integrations",
      params: { projectId: "p1" },
    });
  });

  it("Alt+F toggles the favorite from the team page", () => {
    render(
      <ShortcutTestWrapper>
        <ShortcutHost />
      </ShortcutTestWrapper>,
    );
    fireEvent.keyDown(document.body, {
      key: "ƒ",
      code: "KeyF",
      altKey: true,
    });
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("offers Subscribe and Leave team to members, never Delete", async () => {
    const onLeave = renderMenu(true);

    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "navigation:projectList.subscribe",
      }),
    );
    const added = await screen.findByRole("menuitemcheckbox", {
      name: "navigation:projectList.subscribeIssueAdded",
    });
    expect(added).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemcheckbox", {
        name: "navigation:projectList.subscribeIssueTriage",
      }),
    ).toHaveAttribute("aria-checked", "false");

    fireEvent.click(
      screen.getByRole("menuitemcheckbox", {
        name: "navigation:projectList.subscribeIssueClosed",
      }),
    );
    expect(mutate).toHaveBeenCalledWith(
      { projectId: "p1", notifyIssueClosed: true },
      expect.anything(),
    );

    fireEvent.click(
      screen.getByRole("menuitem", {
        name: "navigation:projectList.leaveTeam",
      }),
    );
    // Leaving asks first: the menu only hands the team to the dialog.
    expect(onLeave).toHaveBeenCalledWith({ id: "p1", name: "Engineering" });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/delete/i)).toBeNull();
  });

  it("joins straight away for someone who left", async () => {
    const onLeave = renderMenu(false);

    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "navigation:projectList.joinTeam",
      }),
    );
    expect(mutate).toHaveBeenCalledWith(
      { projectId: "p1", joined: true },
      expect.anything(),
    );
    expect(onLeave).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("menuitem", {
        name: "navigation:projectList.subscribe",
      }),
    ).toBeNull();
  });
});
