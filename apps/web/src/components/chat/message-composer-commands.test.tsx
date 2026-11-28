import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { MessageComposer } from "./message-composer";

const state = vi.hoisted(() => ({
  post: vi.fn(),
  run: vi.fn(),
  typing: vi.fn(async () => ({})),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options?.name ? `${key}:${options.name}` : key,
  }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/fetchers/chat/drafts", () => ({
  getDrafts: async () => [],
  saveDraft: vi.fn(async () => ({})),
}));
vi.mock("@/fetchers/chat/typing", () => ({ sendTyping: state.typing }));
vi.mock("@/fetchers/chat/commands", () => ({ runChatCommand: state.run }));
vi.mock("@/hooks/mutations/chat/use-post-message", () => ({
  usePostMessage: () => ({ mutate: state.post, isPending: false }),
}));

const box = () =>
  screen.getByLabelText("navigation:chat.messageLabel") as HTMLTextAreaElement;

function send(text: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MessageComposer workspaceId="w1" channelId="c1" channelName="x" />
    </QueryClientProvider>,
  );
  fireEvent.change(box(), { target: { value: text } });
  fireEvent.keyDown(box(), { key: "Enter" });
}

describe("MessageComposer slash commands", () => {
  afterEach(() => {
    cleanup();
    state.post.mockReset();
    state.run.mockReset();
    state.typing.mockClear();
  });

  it("sets a reminder, posts nothing, and tells me only", async () => {
    state.run.mockResolvedValue({
      command: "remind",
      remindAt: "2026-11-28T10:00:00.000Z",
    });
    send("/remind in 1 hour");

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "navigation:chat.commands.reminderSet",
      ),
    );
    expect(state.run).toHaveBeenCalledWith("w1", "c1", "/remind in 1 hour");
    expect(state.post).not.toHaveBeenCalled();
    expect(box().value).toBe("");
    expect(state.typing).not.toHaveBeenCalled();
  });

  it("sets my status", async () => {
    state.run.mockResolvedValue({ command: "status", status: "away" });
    send("/status away");
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "navigation:chat.commands.statusSet",
      ),
    );
  });

  it("files a ticket whose card arrives as a message", async () => {
    state.run.mockResolvedValue({
      command: "ticket",
      taskId: "t1",
      key: "ENG-1",
      messageId: "m1",
    });
    send("/ticket Fix login");
    await waitFor(() => expect(box().value).toBe(""));
    expect(state.run).toHaveBeenCalledWith("w1", "c1", "/ticket Fix login");
    expect(state.post).not.toHaveBeenCalled();
  });

  it("hints at the commands for an unknown one and posts nothing", () => {
    send("/deploy now");
    expect(screen.getByRole("status").textContent).toBe(
      "navigation:chat.commands.unknown:deploy",
    );
    expect(state.run).not.toHaveBeenCalled();
    expect(state.post).not.toHaveBeenCalled();
    expect(box().value).toBe("/deploy now");
  });

  it("shows a refused command's reason and keeps the text", async () => {
    state.run.mockRejectedValue(new Error("Use /ticket <title>"));
    send("/ticket");
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Use /ticket <title>",
      ),
    );
    expect(box().value).toBe("/ticket");
  });
});
