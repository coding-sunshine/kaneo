import { cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { NavMain } from "./nav-main";

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => "/dashboard/workspace/w1",
  useNavigate: () => vi.fn(),
}));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul>{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));
vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CollapsiblePanel: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
// The dialog has its own coverage; loading it would boot real translations.
vi.mock("@/components/sidebar-customize/customize-sidebar-dialog", () => ({
  CustomizeSidebarDialog: () => null,
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w1" } }),
}));
vi.mock("@/hooks/queries/invitation/use-pending-invitations", () => ({
  usePendingInvitations: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/notification/use-get-notifications", () => ({
  default: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/agent/use-agent", () => ({
  useHasAgent: () => false,
}));

const defaultSidebar = useUserPreferencesStore.getState().sidebar;
beforeEach(() =>
  useUserPreferencesStore.setState({
    codeReviewsEnabled: true,
    sidebar: defaultSidebar,
  }),
);
const buttonLabels = () =>
  screen.getAllByRole("button").map((button) => button.textContent);
afterEach(cleanup);

describe("NavMain reviews row", () => {
  it("shows Reviews after My issues and hides it when disabled", () => {
    const { unmount } = render(<NavMain />);
    const labels = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels.indexOf("navigation:sidebar.reviews")).toBe(
      labels.indexOf("navigation:sidebar.myTasks") + 1,
    );
    unmount();

    useUserPreferencesStore.setState({ codeReviewsEnabled: false });
    render(<NavMain />);
    expect(
      screen.queryByText("navigation:sidebar.reviews"),
    ).not.toBeInTheDocument();
  });

  it("shows a Pulse row", () => {
    render(<NavMain />);
    const labels = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels).toContain("navigation:sidebar.pulse");
  });
});

describe("NavMain customization", () => {
  it("starts with Members and Teams behind More", () => {
    render(<NavMain />);
    expect(buttonLabels()).toEqual([
      "navigation:sidebar.inbox",
      "navigation:sidebar.myTasks",
      "navigation:sidebar.reviews",
      "navigation:sidebar.pulse",
      "navigation:sidebar.documents",
      "navigation:sidebar.projects",
      "navigation:sidebar.views",
      "navigation:sidebar.more",
    ]);
  });

  it("follows saved visibility and order", () => {
    useUserPreferencesStore.setState({
      sidebar: {
        ...defaultSidebar,
        visibility: { projects: "never", members: "always", inbox: "badged" },
        order: { personal: ["documents"] },
      },
    });
    render(<NavMain />);
    // Inbox is badged-only and has no unread notifications here.
    expect(buttonLabels()).toEqual([
      "navigation:sidebar.documents",
      "navigation:sidebar.myTasks",
      "navigation:sidebar.reviews",
      "navigation:sidebar.pulse",
      "navigation:sidebar.views",
      "navigation:sidebar.members",
      "navigation:sidebar.more",
    ]);
  });
});
