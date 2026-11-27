import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { ChatMessage } from "@/components/chat/types";
import { MessageList } from "./message-list";

const { editMessage, deleteMessage, pinMessage } = vi.hoisted(() => ({
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  pinMessage: vi.fn(),
}));
vi.mock("@/hooks/mutations/chat/use-message-mutations", () => ({
  useEditMessage: () => ({ mutate: editMessage, isPending: false }),
  useDeleteMessage: () => ({ mutate: deleteMessage }),
  usePinMessage: () => ({ mutate: pinMessage }),
  useReactToMessage: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/components/chat/message-reactions", () => ({
  MessageReactions: () => null,
}));

const renderList = (
  messages: ChatMessage[],
  props: Partial<ComponentProps<typeof MessageList>> = {},
) =>
  render(
    <MessageList
      messages={messages}
      workspaceId="ws"
      channelId="channel-1"
      currentUserId="user-1"
      canWrite={false}
      {...props}
    />,
  );

const message = (patch: Partial<ChatMessage> = {}) =>
  ({
    id: "message-1",
    channelId: "channel-1",
    body: "hello",
    userId: "user-1",
    authorName: "Test author",
    editedAt: null,
    pinnedAt: null,
    reactions: [],
    createdAt: "2026-01-02T03:04:05.000Z",
    ...patch,
  }) as ChatMessage;

// jsdom does not lay out, so it has no scrollIntoView.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MessageList", () => {
  it("shows each message's author, time and text", () => {
    renderList([message()]);
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
    const { container } = renderList([message()]);
    const item = screen.getByRole("listitem");
    expect(item.textContent).toBe(
      `Test author${item.querySelector("time")?.textContent}hello`,
    );
    expect(container.querySelector(".rounded-full")).toBeNull();
  });

  it("names a deleted author", () => {
    renderList([message({ authorName: null })]);
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
    renderList([message({ linkPreview })]);
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
    renderList([message({ userId: "user-2", linkPreview })], {
      onRemovePreview,
    });
    expect(
      screen.queryByRole("button", { name: "navigation:chat.removePreview" }),
    ).toBeNull();

    cleanup();
    renderList([message({ userId: "user-1", linkPreview })], {
      onRemovePreview,
    });
    screen
      .getByRole("button", { name: "navigation:chat.removePreview" })
      .click();
    expect(onRemovePreview).toHaveBeenCalledWith("message-1");
  });

  it("turns a pasted meeting link into a link that opens in a new tab", () => {
    renderList([message({ body: "call: https://meet.example.test/abc-defg" })]);
    const link = screen.getByRole("link", {
      name: "https://meet.example.test/abc-defg",
    });
    expect(link).toHaveAttribute("href", "https://meet.example.test/abc-defg");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("listitem")).toHaveTextContent("call:");
  });

  it("invites the first message in an empty channel", () => {
    renderList([]);
    expect(screen.getByText("navigation:chat.noMessages")).toBeTruthy();
  });

  it("scrolls to and marks the message a search result opened", () => {
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    renderList(
      [
        message({ id: "older", body: "older" }),
        message({ id: "target", body: "target" }),
        message({ id: "newer", body: "newer" }),
      ],
      { focusId: "target" },
    );
    const target = screen.getByText("target").closest("li");
    expect(target).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("newer").closest("li")).not.toHaveAttribute(
      "aria-current",
    );
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(target);
  });

  it("marks an edited message", () => {
    renderList([message({ editedAt: "2026-01-02T04:00:00.000Z" })]);
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "navigation:chat.edited",
    );
  });

  it("offers edit, delete and pin on your own message", async () => {
    renderList([message()], { canWrite: true });
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.messageActions" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "navigation:chat.pin" }),
    );
    expect(pinMessage).toHaveBeenCalledWith(
      { messageId: "message-1", pinned: true },
      expect.anything(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.messageActions" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "navigation:chat.deleteMessage",
      }),
    );
    expect(deleteMessage).toHaveBeenCalledWith("message-1", expect.anything());

    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.messageActions" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "navigation:chat.editMessage",
      }),
    );
    const editor = screen.getByRole("textbox", {
      name: "navigation:chat.editMessage",
    });
    fireEvent.change(editor, { target: { value: "new text" } });
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.save" }),
    );
    expect(editMessage).toHaveBeenCalledWith(
      { messageId: "message-1", body: "new text" },
      expect.anything(),
    );
  });

  it("offers only pinning on someone else's message", async () => {
    renderList(
      [message({ userId: "user-2", pinnedAt: "2026-01-03T00:00:00Z" })],
      {
        canWrite: true,
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.messageActions" }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "navigation:chat.unpin" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("menuitem", { name: "navigation:chat.editMessage" }),
    ).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: "navigation:chat.deleteMessage" }),
    ).toBeNull();
  });

  it("shows no message actions to someone who cannot write", () => {
    renderList([message()]);
    expect(
      screen.queryByRole("button", { name: "navigation:chat.messageActions" }),
    ).toBeNull();
  });

  it("shows a presence dot only on authors who are online", () => {
    renderList(
      [
        message(),
        message({ id: "message-2", userId: "user-2", authorName: "Other" }),
      ],
      { online: new Set(["user-2"]) },
    );
    const [first, second] = screen.getAllByRole("listitem");
    expect(
      within(second as HTMLElement).getByRole("img", {
        name: "navigation:chat.online",
      }),
    ).toBeTruthy();
    expect(within(first as HTMLElement).queryByRole("img")).toBeNull();
  });
});
