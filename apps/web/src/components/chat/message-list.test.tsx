import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { ChatMessage } from "@/components/chat/types";
import { MessageList } from "./message-list";

const message = (patch: Partial<ChatMessage> = {}) =>
  ({
    id: "message-1",
    channelId: "channel-1",
    body: "hello",
    authorId: "user-1",
    authorName: "Test author",
    createdAt: "2026-01-02T03:04:05.000Z",
    ...patch,
  }) as ChatMessage;

// jsdom does not lay out, so it has no scrollIntoView.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("MessageList", () => {
  it("shows each message's author, time and text", () => {
    render(<MessageList messages={[message()]} />);
    const item = within(
      screen.getByRole("list", { name: "navigation:chat.messages" }),
    ).getByRole("listitem");
    expect(item).toHaveTextContent("Test author");
    expect(item).toHaveTextContent("hello");
    expect(item.querySelector("time")).toHaveAttribute(
      "dateTime",
      "2026-01-02T03:04:05.000Z",
    );
  });

  // Chat shows no read receipts and no presence until someone opts in.
  it("shows nothing about who has read a message or who is online", () => {
    const { container } = render(<MessageList messages={[message()]} />);
    const item = screen.getByRole("listitem");
    expect(item.textContent).toBe(
      `Test author${item.querySelector("time")?.textContent}hello`,
    );
    expect(container.querySelector(".rounded-full")).toBeNull();
  });

  it("names a deleted author", () => {
    render(<MessageList messages={[message({ authorName: null })]} />);
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "navigation:chat.deletedUser",
    );
  });

  it("shows a card for the link preview that opens the page in a new tab", () => {
    const linkPreview = {
      url: "https://example.com/",
      title: "Example Domain",
      description: "For documentation examples.",
      siteName: "example.com",
    };
    render(<MessageList messages={[message({ linkPreview })]} />);
    const card = screen.getByRole("link", { name: /Example Domain/ });
    expect(card).toHaveAttribute("href", "https://example.com/");
    expect(card).toHaveAttribute("target", "_blank");
    expect(card).toHaveAttribute("rel", "noopener noreferrer");
    expect(card).toHaveTextContent("For documentation examples.");
    expect(card).toHaveTextContent("example.com");
  });

  it("lets only the author remove a link preview", () => {
    const linkPreview = {
      url: "https://example.com/",
      title: "Example Domain",
      description: null,
      siteName: "example.com",
    };
    const onRemovePreview = vi.fn();
    const { rerender } = render(
      <MessageList
        messages={[message({ userId: "user-2", linkPreview })]}
        currentUserId="user-1"
        onRemovePreview={onRemovePreview}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "navigation:chat.removePreview" }),
    ).toBeNull();

    rerender(
      <MessageList
        messages={[message({ userId: "user-1", linkPreview })]}
        currentUserId="user-1"
        onRemovePreview={onRemovePreview}
      />,
    );
    screen
      .getByRole("button", { name: "navigation:chat.removePreview" })
      .click();
    expect(onRemovePreview).toHaveBeenCalledWith("message-1");
  });

  it("turns a pasted meeting link into a link that opens in a new tab", () => {
    render(
      <MessageList
        messages={[
          message({ body: "call: https://meet.example.test/abc-defg" }),
        ]}
      />,
    );
    const link = screen.getByRole("link", {
      name: "https://meet.example.test/abc-defg",
    });
    expect(link).toHaveAttribute("href", "https://meet.example.test/abc-defg");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("listitem")).toHaveTextContent("call:");
  });

  it("invites the first message in an empty channel", () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByText("navigation:chat.noMessages")).toBeTruthy();
  });

  it("scrolls to and marks the message a search result opened", () => {
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    render(
      <MessageList
        messages={[
          message({ id: "older", body: "older" }),
          message({ id: "target", body: "target" }),
          message({ id: "newer", body: "newer" }),
        ]}
        focusId="target"
      />,
    );
    const target = screen.getByText("target").closest("li");
    expect(target).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("newer").closest("li")).not.toHaveAttribute(
      "aria-current",
    );
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(target);
  });
});
