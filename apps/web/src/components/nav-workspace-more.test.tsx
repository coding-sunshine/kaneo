import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SquareUser, Users } from "lucide-react";
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

const hidden = [
  { title: "Members", icon: Users, url: "/dashboard/workspace/w1/members" },
  { title: "Teams", icon: SquareUser, url: "/dashboard/settings/projects" },
];

afterEach(() => {
  cleanup();
  navigate.mockClear();
});

const openMore = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "navigation:sidebar.more" }),
  );

describe("NavWorkspaceMore", () => {
  it("lists the hidden rows, then Customize sidebar, like Linear's More menu", async () => {
    const onCustomize = vi.fn();
    render(<NavWorkspaceMore hidden={hidden} onCustomize={onCustomize} />);
    openMore();

    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Members",
      "Teams",
      "navigation:customizeSidebar.open",
    ]);

    fireEvent.click(items[1]);
    expect(navigate).toHaveBeenCalledWith({
      to: "/dashboard/settings/projects",
    });

    openMore();
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "navigation:customizeSidebar.open",
      }),
    );
    expect(onCustomize).toHaveBeenCalledOnce();
  });

  it("offers only Customize sidebar when every row is shown", async () => {
    render(<NavWorkspaceMore hidden={[]} onCustomize={vi.fn()} />);
    openMore();
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "navigation:customizeSidebar.open",
    ]);
  });
});
