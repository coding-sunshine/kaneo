import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { InboxDailyBrief } from "./inbox-daily-brief";

const state = vi.hoisted(() => ({
  brief: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
  }: {
    children: React.ReactNode;
    to: string;
    params: Record<string, string>;
    search?: Record<string, string>;
  }) => {
    let href = to;
    for (const [key, value] of Object.entries(params))
      href = href.replace(`$${key}`, value);
    if (search?.messageId) href += `?messageId=${search.messageId}`;
    return <a href={href}>{children}</a>;
  },
}));
vi.mock("@/hooks/queries/daily-brief/use-daily-brief", () => ({
  useBrief: () => state.brief(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InboxDailyBrief", () => {
  it("links each due ticket, mention and moved ticket", () => {
    state.brief.mockReturnValue({
      data: {
        id: "b1",
        day: "2026-03-10",
        dueToday: [
          { id: "t1", title: "Ship notes", ticket: "WEB-1", projectId: "p1" },
        ],
        mentions: [
          {
            messageId: "m1",
            channelId: "c1",
            channelName: "x",
            preview: "@Blair review this",
            createdAt: "2026-03-10T06:00:00.000Z",
          },
        ],
        moved: [
          {
            id: "t2",
            title: "Checkout",
            ticket: "WEB-2",
            projectId: "p1",
            status: "in-progress",
          },
        ],
        createdAt: "2026-03-10T08:30:00.000Z",
      },
    });
    render(<InboxDailyBrief workspaceId="ws1" briefId="b1" />);
    expect(
      screen.getByText("Ship notes").closest("a")?.getAttribute("href"),
    ).toBe("/dashboard/workspace/ws1/project/p1/task/t1");
    expect(
      screen.getByText("@Blair review this").closest("a")?.getAttribute("href"),
    ).toBe("/dashboard/workspace/ws1/channels/c1?messageId=m1");
    expect(screen.getByText("in-progress")).toBeTruthy();
  });

  it("says so when the brief cannot be opened", () => {
    state.brief.mockReturnValue({ data: undefined, isError: true });
    render(<InboxDailyBrief workspaceId="ws1" briefId="b1" />);
    expect(screen.getByRole("alert").textContent).toBe(
      "notifications:dailyBrief.missing",
    );
  });
});
