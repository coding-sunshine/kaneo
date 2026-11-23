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
const reviews = vi.hoisted(() => ({
  state: "connected" as string,
  toReview: [] as unknown[],
}));
vi.mock("@/hooks/queries/github-reviews/use-github-reviews", () => ({
  useReviewsStatus: () => ({ data: { state: reviews.state } }),
  useReviewsList: (_options: unknown, enabled: boolean) => ({
    data: enabled ? { toReview: reviews.toReview } : undefined,
  }),
}));
vi.mock("@/hooks/queries/agent/use-agent", () => ({
  useHasAgent: () => false,
}));
const drafts = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock("@/hooks/queries/task-draft/use-task-drafts", () => ({
  useTaskDrafts: () => ({ data: drafts.list }),
}));

const defaultSidebar = useUserPreferencesStore.getState().sidebar;
beforeEach(() => {
  reviews.state = "connected";
  reviews.toReview = [];
  drafts.list = [];
  useUserPreferencesStore.setState({
    codeReviewsEnabled: true,
    sidebar: defaultSidebar,
  });
});
const buttonLabels = () =>
  screen.getAllByRole("button").map((button) => button.textContent);
afterEach(cleanup);

describe("NavMain reviews row", () => {
  it("badges Reviews with the PRs awaiting review, and not when GitHub is disconnected", () => {
    reviews.toReview = [{}, {}];
    const { unmount } = render(<NavMain />);
    expect(screen.getByText("2")).toBeTruthy();
    unmount();
    reviews.state = "disconnected";
    render(<NavMain />);
    expect(screen.queryByText("2")).toBeNull();
  });

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

  it("shows Drafts with its count only once a draft exists", () => {
    const { unmount } = render(<NavMain />);
    expect(buttonLabels()).not.toContain("navigation:sidebar.drafts");
    unmount();
    drafts.list = [{}, {}, {}];
    render(<NavMain />);
    expect(buttonLabels()).toContain("navigation:sidebar.drafts3");
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
