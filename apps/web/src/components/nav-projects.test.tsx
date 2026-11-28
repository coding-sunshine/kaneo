import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NavProjects } from "./nav-projects";

const state = vi.hoisted(() => ({
  projects: [] as Array<{
    id: string;
    name: string;
    membership: { joined: boolean };
  }>,
  onDragEnd: null as null | ((event: unknown) => void),
  reorder: vi.fn(),
}));

vi.mock("@dnd-kit/core", async () => ({
  ...(await vi.importActual<object>("@dnd-kit/core")),
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragEnd: (event: unknown) => void;
  }) => {
    state.onDragEnd = onDragEnd;
    return <>{children}</>;
  },
  DragOverlay: () => null,
}));
vi.mock("@dnd-kit/sortable", async () => ({
  ...(await vi.importActual<object>("@dnd-kit/sortable")),
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSortable: () => ({
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({}),
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w1" } }),
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: state.projects }),
}));
vi.mock("@/hooks/mutations/project/use-reorder-projects", () => ({
  default: () => state.reorder,
}));
vi.mock("@/hooks/use-board-hover-prefetch", () => ({
  useBoardHoverPrefetch: () => () => ({}),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateProjects: () => true,
    canUpdateProjects: () => true,
  }),
}));
vi.mock("@/components/chat/channels-nav", () => ({
  ChannelsNav: () => null,
}));
vi.mock("@/components/chat/direct-messages-nav", () => ({
  DirectMessagesNav: () => null,
}));
vi.mock("@/components/chat/drafts-nav", () => ({
  DraftsNav: () => null,
}));
vi.mock("@/components/team/favorites-nav", () => ({
  FavoritesNav: () => null,
}));
vi.mock("@/components/team/leave-team-dialog", () => ({
  LeaveTeamDialog: () => null,
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/team/team-nav-row", () => ({ TeamNavRow: () => null }));
vi.mock("./shared/modals/create-project-modal", () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const team = (id: string, joined: boolean) => ({
  id,
  name: id,
  membership: { joined },
});

describe("NavProjects drag reorder", () => {
  it("reorders joined teams while a left team keeps its slot", () => {
    state.projects = [team("a", true), team("left", false), team("b", true)];
    render(<NavProjects />);

    state.onDragEnd?.({ active: { id: "b" }, over: { id: "a" } });

    const [workspaceId, ordered] = state.reorder.mock.calls[0];
    expect(workspaceId).toBe("w1");
    const ids = ordered.map((project: { id: string }) => project.id);
    // Joined teams trade places; the team that was left stays in the middle.
    expect(ids).toEqual(["b", "left", "a"]);
  });

  it("ignores a drop onto itself", () => {
    state.projects = [team("a", true), team("left", false)];
    render(<NavProjects />);
    state.onDragEnd?.({ active: { id: "a" }, over: { id: "a" } });
    expect(state.reorder).not.toHaveBeenCalled();
  });
});

describe("NavProjects with no joined teams", () => {
  const renderNav = () =>
    render(
      <SidebarProvider>
        <NavProjects />
      </SidebarProvider>,
    );

  it("offers a way back after leaving every team", () => {
    state.projects = [team("left", false)];
    renderNav();
    expect(screen.getByText("navigation:sidebar.browseTeams")).toBeTruthy();
  });

  it("hides the link while any team is joined", () => {
    state.projects = [team("a", true), team("left", false)];
    renderNav();
    expect(screen.queryByText("navigation:sidebar.browseTeams")).toBeNull();
  });
});
