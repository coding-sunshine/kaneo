import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { NavWorkspaceMore } from "./nav-workspace-more";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuButton: (props: React.ComponentProps<"button">) => (
    <button type="button" {...props} />
  ),
}));

afterEach(() => {
  cleanup();
  navigate.mockClear();
});

describe("NavWorkspaceMore", () => {
  it("opens Members and Teams like Linear's More menu", async () => {
    render(<NavWorkspaceMore homeUrl="/dashboard/workspace/w1" />);
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:sidebar.more" }),
    );

    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "navigation:sidebar.members",
      "navigation:sidebar.teams",
    ]);

    fireEvent.click(items[0]);
    expect(navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/w1/members",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:sidebar.more" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "navigation:sidebar.teams" }),
    );
    expect(navigate).toHaveBeenLastCalledWith({
      to: "/dashboard/settings/projects",
    });
  });
});
