import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DraftsNav } from "./drafts-nav";

const state = vi.hoisted(() => ({
  drafts: [] as { channelId: string; body: string; updatedAt: string }[],
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));
vi.mock("@/hooks/queries/chat/use-drafts", () => ({
  useDrafts: () => ({ data: state.drafts }),
}));
vi.mock("@/hooks/queries/chat/use-channels", () => ({
  useChannels: () => ({
    data: [
      { id: "x", name: "design", isPrivate: false, isDirect: false },
      { id: "y", name: "random", isPrivate: false, isDirect: false },
    ],
  }),
}));
vi.mock("@/hooks/queries/chat/use-direct-messages", () => ({
  useDirectMessages: () => ({
    data: [
      { id: "d", memberIds: ["me", "b"], isPrivate: true, isDirect: true },
    ],
  }),
}));
vi.mock("@/hooks/use-direct-message-title", () => ({
  useDirectMessageTitle: () => () => "Person B",
}));

describe("DraftsNav", () => {
  afterEach(() => {
    cleanup();
    state.drafts = [];
  });

  it("lists each channel that holds a draft", () => {
    state.drafts = [
      { channelId: "x", body: "half written", updatedAt: "2026-01-02" },
      { channelId: "d", body: "hi", updatedAt: "2026-01-01" },
    ];
    render(
      <SidebarProvider>
        <DraftsNav workspaceId="w1" />
      </SidebarProvider>,
    );

    expect(screen.getByText("navigation:chat.drafts")).toBeTruthy();
    expect(screen.getByText("design")).toBeTruthy();
    expect(screen.getByText("Person B")).toBeTruthy();
    expect(screen.queryByText("random")).toBeNull();
  });

  it("shows nothing without drafts", () => {
    const { container } = render(<DraftsNav workspaceId="w1" />);
    expect(container.textContent).toBe("");
  });
});
