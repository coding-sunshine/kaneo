import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { InboxChatMessage } from "./inbox-chat-message";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    search,
    children,
    ...props
  }: {
    to: string;
    params: Record<string, string>;
    search: { messageId: string };
    children?: ReactNode;
  }) => (
    <a
      {...props}
      href={`${Object.entries(params).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}?messageId=${search.messageId}`}
    >
      {children}
    </a>
  ),
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe("inbox chat message", () => {
  it("links to the channel opened at the message", () => {
    render(
      <InboxChatMessage workspaceId="ws-1" channelId="ch-1" messageId="m-1" />,
    );
    expect(
      screen
        .getByRole("link", { name: /notifications:inbox.openMessage/ })
        .getAttribute("href"),
    ).toBe("/dashboard/workspace/ws-1/channels/ch-1?messageId=m-1");
  });
});
