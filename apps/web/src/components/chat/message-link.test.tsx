import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { MessageLink } from "./message-link";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    search,
  }: {
    children: React.ReactNode;
    params: { workspaceId: string; channelId: string };
    search: { messageId: string };
  }) => (
    <a
      href={`/${params.workspaceId}/${params.channelId}?m=${search.messageId}`}
    >
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("MessageLink", () => {
  it("links to the message in its channel under a short name", () => {
    render(
      <MessageLink
        target={{ workspaceId: "w1", channelId: "c1", messageId: "m1" }}
      />,
    );
    expect(
      screen.getByRole("link", { name: "navigation:chat.messageLink" }),
    ).toHaveAttribute("href", "/w1/c1?m=m1");
  });
});
