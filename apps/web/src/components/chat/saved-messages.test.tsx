import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SavedMessages } from "./saved-messages";

const state = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    search,
  }: {
    children?: React.ReactNode;
    params: { channelId: string };
    search: { messageId: string };
  }) => (
    <a href={`/channels/${params.channelId}?messageId=${search.messageId}`}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/mutations/chat/use-later-mutations", () => ({
  useSaveMessage: () => ({ mutate: state.save }),
}));
vi.mock("@/hooks/queries/chat/use-saved-messages", () => ({
  useSavedMessages: () => ({
    data: [{ id: "m1", channelId: "c2", authorName: "Sam", body: "the plan" }],
  }),
}));

describe("SavedMessages", () => {
  afterEach(cleanup);

  it("lists my saved messages with a link to each, and removes one from the list", async () => {
    render(<SavedMessages workspaceId="w1" />);
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.saved" }),
    );

    expect(await screen.findByText("the plan")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "navigation:chat.openSaved" }),
    ).toHaveProperty(
      "href",
      expect.stringContaining("/channels/c2?messageId=m1"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.unsaveMessage" }),
    );
    expect(state.save).toHaveBeenCalledWith(
      { workspaceId: "w1", channelId: "c2", messageId: "m1", saved: false },
      expect.anything(),
    );
  });
});
