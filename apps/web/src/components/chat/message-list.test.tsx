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

  it("invites the first message in an empty channel", () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByText("navigation:chat.noMessages")).toBeTruthy();
  });
});
