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
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w1" } }),
}));
vi.mock("@/hooks/queries/invitation/use-pending-invitations", () => ({
  usePendingInvitations: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/notification/use-get-notifications", () => ({
  default: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/task/use-get-assigned-tasks", () => ({
  default: () => ({ data: undefined }),
}));

beforeEach(() =>
  useUserPreferencesStore.setState({ codeReviewsEnabled: true }),
);
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
});
