import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { MessageReactions } from "./message-reactions";

const { react } = vi.hoisted(() => ({ react: vi.fn() }));
vi.mock("@/hooks/mutations/chat/use-message-mutations", () => ({
  useReactToMessage: () => ({ mutate: react }),
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "ws" } }),
}));
vi.mock("@/hooks/queries/workspace-users/use-get-workspace-users", () => ({
  default: () => ({
    data: [
      { user: { id: "user-1", name: "First person" } },
      { user: { id: "user-2", name: "Second person" } },
    ],
  }),
}));
vi.mock("@/components/activity/add-reaction-button", () => ({
  default: ({ onSelect }: { onSelect: (emoji: string) => void }) => (
    <button type="button" onClick={() => onSelect(":party_parrot:")}>
      add reaction
    </button>
  ),
}));
vi.mock("@/components/activity/emoji-picker/emoji-glyph", () => ({
  default: ({ emoji }: { emoji: string }) => <>{emoji}</>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { names?: string }) =>
      options?.names ? `${options.names} ${key}` : key,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderReactions = (canReact = true) =>
  render(
    <MessageReactions
      workspaceId="ws"
      channelId="channel-1"
      messageId="message-1"
      currentUserId="user-1"
      canReact={canReact}
      reactions={[{ emoji: "👍", userIds: ["user-1", "user-2"] }]}
    />,
  );

describe("MessageReactions", () => {
  it("counts each emoji and names everyone who used it", () => {
    renderReactions();
    const chip = screen.getByRole("button", {
      name: /First person and Second person/,
    });
    expect(chip).toHaveTextContent("👍2");
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("takes your reaction back when you click it again", () => {
    renderReactions();
    fireEvent.click(screen.getByRole("button", { name: /First person/ }));
    expect(react).toHaveBeenCalledWith(
      { messageId: "message-1", emoji: "👍", reacted: false },
      expect.anything(),
    );
  });

  it("adds a custom emoji from the picker", () => {
    renderReactions();
    fireEvent.click(screen.getByRole("button", { name: "add reaction" }));
    expect(react).toHaveBeenCalledWith(
      { messageId: "message-1", emoji: ":party_parrot:", reacted: true },
      expect.anything(),
    );
  });

  it("only shows reactions to someone who cannot react", () => {
    renderReactions(false);
    expect(screen.queryByRole("button", { name: "add reaction" })).toBeNull();
    expect(screen.getByRole("button", { name: /First person/ })).toBeDisabled();
  });
});
