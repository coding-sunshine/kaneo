import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ChatChannel } from "@/components/chat/types";
import { ChannelNavItem } from "./channel-nav-item";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenuItem: ({ children }: { children: ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuButton: ({ children }: { children: ReactNode }) => (
    <a href="/">{children}</a>
  ),
  SidebarMenuBadge: (props: { children: ReactNode }) => (
    <span data-testid="badge" {...props} />
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

afterEach(cleanup);

const channel = (unreadCount: number) =>
  ({
    id: "channel-1",
    name: "general",
    isPrivate: false,
    isMember: true,
    archivedAt: null,
    unreadCount,
  }) as ChatChannel;

describe("ChannelNavItem", () => {
  it("shows a bold name and a count when there is something new", () => {
    render(<ChannelNavItem workspaceId="ws" channel={channel(3)} />);
    expect(screen.getByText("general")).toHaveClass("font-semibold");
    expect(screen.getByTestId("badge")).toHaveTextContent("3");
    expect(screen.getByTestId("badge")).toHaveAttribute(
      "aria-label",
      "navigation:chat.unread:3",
    );
  });

  it("shows a plain name when everything is read", () => {
    render(<ChannelNavItem workspaceId="ws" channel={channel(0)} />);
    expect(screen.getByText("general")).not.toHaveClass("font-semibold");
    expect(screen.queryByTestId("badge")).toBeNull();
  });
});
