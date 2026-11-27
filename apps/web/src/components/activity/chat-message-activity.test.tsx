import { cleanup, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import type { ReactNode } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";
import enUS from "../../../../../i18n/en-US.json";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import ChatMessageActivity from "./chat-message-activity";
import { chatMessageEntry } from "./chat-message-entry";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    params,
    search,
    children,
  }: {
    params: { workspaceId: string; channelId: string };
    search: { messageId: string };
    children: ReactNode;
  }) => (
    <a
      href={`/dashboard/workspace/${params.workspaceId}/channels/${params.channelId}?messageId=${search.messageId}`}
    >
      {children}
    </a>
  ),
}));

// The real strings through the real Trans: a tag name the HTML parser treats
// as void (such as <link>) would leave the link empty.
const i18n = createInstance();
await i18n.use(initReactI18next).init({
  lng: "en-US",
  resources: { "en-US": { activity: enUS.activity } },
});

describe("ChatMessageActivity", () => {
  afterEach(cleanup);

  it.each([
    ["created_from_chat_message", "created this ticket from a chat message"],
    ["chat_message_added", "added a chat message as a comment"],
  ])("links %s back to the message", (type, sentence) => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <ChatMessageActivity
          type={type}
          workspaceId="w1"
          channelId="c1"
          messageId="m1"
        />
      </I18nextProvider>,
    );
    expect(container.textContent).toBe(sentence);
    expect(
      screen.getByRole("link", { name: "chat message" }).getAttribute("href"),
    ).toBe("/dashboard/workspace/w1/channels/c1?messageId=m1");
  });
});

describe("chatMessageEntry", () => {
  const ids = { channelId: "c1", messageId: "m1" };

  it("reads the ids of the two chat entries", () => {
    expect(chatMessageEntry("chat_message_added", ids)).toEqual(ids);
    expect(chatMessageEntry("created_from_chat_message", ids)).toEqual(ids);
  });

  it("ignores other entries and ones missing an id", () => {
    expect(chatMessageEntry("comment", ids)).toBeNull();
    expect(
      chatMessageEntry("chat_message_added", { channelId: "c1" }),
    ).toBeNull();
    expect(chatMessageEntry("chat_message_added", null)).toBeNull();
  });
});
