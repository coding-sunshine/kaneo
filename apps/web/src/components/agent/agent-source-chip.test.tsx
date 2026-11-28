import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { AgentSourceChip } from "./agent-source-chip";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
  }: {
    children: ReactNode;
    to: string;
    params: Record<string, string>;
    search?: Record<string, string>;
  }) => {
    const path = Object.entries(params).reduce(
      (href, [key, value]) => href.replace(`$${key}`, value),
      to,
    );
    const query = search ? `?${new URLSearchParams(search)}` : "";
    return <a href={`${path}${query}`}>{children}</a>;
  },
}));

afterEach(cleanup);

describe("AgentSourceChip", () => {
  it("links a chat message to its place in the channel", () => {
    render(
      <AgentSourceChip
        workspaceId="w1"
        citation={{
          kind: "message",
          restricted: false,
          id: "m1",
          title: "We decided on vendor B.",
          channelId: "c1",
        }}
      />,
    );
    expect(
      screen.getByRole("link", { name: "We decided on vendor B." }),
    ).toHaveProperty(
      "href",
      expect.stringContaining(
        "/dashboard/workspace/w1/channels/c1?messageId=m1",
      ),
    );
  });

  it("shows a message the reader cannot open as restricted, with no text", () => {
    render(
      <AgentSourceChip
        workspaceId="w1"
        citation={{ kind: "message", restricted: true }}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByText("navigation:agent.sources.restricted"),
    ).toBeTruthy();
  });
});
