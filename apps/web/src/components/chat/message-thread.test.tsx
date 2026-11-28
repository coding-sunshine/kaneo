import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { ChatMessage } from "@/components/chat/types";
import { MessageList } from "./message-list";

const { postReply, replies } = vi.hoisted(() => ({
  postReply: vi.fn(),
  replies: { current: [] as unknown[] },
}));
vi.mock("@/hooks/mutations/chat/use-message-mutations", () => ({
  useEditMessage: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteMessage: () => ({ mutate: vi.fn() }),
  usePinMessage: () => ({ mutate: vi.fn() }),
  useReactToMessage: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/mutations/chat/use-post-reply", () => ({
  usePostReply: () => ({ mutate: postReply, isPending: false }),
}));
vi.mock("@/hooks/queries/chat/use-replies", () => ({
  useReplies: () => ({ data: replies.current, isPending: false }),
}));
vi.mock("@/components/chat/message-reactions", () => ({
  MessageReactions: () => null,
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canCreateTasks: () => true }),
}));
vi.mock("@/components/chat/add-to-ticket-dialog", () => ({
  AddToTicketDialog: () => null,
}));

const message = (patch: Partial<ChatMessage> = {}) =>
  ({
    id: "message-1",
    channelId: "channel-1",
    body: "Shall we ship?",
    userId: "user-1",
    authorName: "Test author",
    editedAt: null,
    pinnedAt: null,
    parentId: null,
    replyCount: 0,
    reactions: [],
    files: [],
    mentions: [],
    createdAt: "2026-01-02T03:04:05.000Z",
    ...patch,
  }) as ChatMessage;

const renderList = (messages: ChatMessage[], canWrite = true) =>
  render(
    <MessageList
      messages={messages}
      workspaceId="ws"
      channelId="channel-1"
      currentUserId="user-1"
      canWrite={canWrite}
    />,
  );

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  replies.current = [];
});

describe("Message threads", () => {
  it("opens a reply box under a message and posts the reply to its thread", () => {
    renderList([message()]);
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.reply" }),
    );

    const box = screen.getByRole("textbox", {
      name: "navigation:chat.replyLabel",
    });
    fireEvent.change(box, { target: { value: "Yes, today" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(postReply).toHaveBeenCalledWith("Yes, today", expect.anything());
  });

  it("shows the reply count and the replies under their message", () => {
    replies.current = [
      message({ id: "r1", body: "Yes, today", parentId: "message-1" }),
      message({ id: "r2", body: "Agreed", parentId: "message-1" }),
    ];
    renderList([message({ replyCount: 2 })]);

    const toggle = screen.getByRole("button", {
      name: "navigation:chat.replyCount",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const thread = screen.getByRole("list", {
      name: "navigation:chat.thread",
    });
    expect(
      within(thread)
        .getAllByRole("listitem")
        .map((item) => item.querySelector("p")?.textContent),
    ).toEqual(["Yes, today", "Agreed"]);
    // A reply is not a thread of its own.
    expect(
      within(thread).queryByRole("button", { name: "navigation:chat.reply" }),
    ).toBeNull();
  });

  it("lets someone who cannot write read a thread but not reply", () => {
    replies.current = [message({ id: "r1", parentId: "message-1" })];
    renderList([message({ replyCount: 1 })], false);
    expect(
      screen.queryByRole("button", { name: "navigation:chat.reply" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.replyCount" }),
    );
    expect(
      screen.getByRole("list", { name: "navigation:chat.thread" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("textbox", { name: "navigation:chat.replyLabel" }),
    ).toBeNull();
  });
});
