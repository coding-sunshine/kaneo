import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ChatChannelDetail } from "@/components/chat/types";
import { ChannelHeader } from "./channel-header";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/chat/call-button", () => ({ CallButton: () => null }));
vi.mock("@/components/chat/pinned-messages", () => ({
  PinnedMessages: () => null,
}));
vi.mock("@/components/chat/saved-messages", () => ({
  SavedMessages: () => null,
}));
vi.mock("@/components/chat/mute-channel-button", () => ({
  MuteChannelButton: () => null,
}));
vi.mock("@/components/chat/channel-actions", () => ({
  ChannelActions: () => null,
}));
vi.mock("@/components/chat/channel-ai-switch", () => ({
  ChannelAiSwitch: ({ channel }: { channel: ChatChannelDetail }) => (
    <span>ai switch for {channel.id}</span>
  ),
}));

afterEach(cleanup);

const channel = (isDirect: boolean) =>
  ({
    id: isDirect ? "dm" : "general",
    isDirect,
    isPrivate: isDirect,
    memberIds: [],
    archivedAt: null,
  }) as unknown as ChatChannelDetail;

describe("ChannelHeader", () => {
  it.each([false, true])(
    "shows the AI switch in the header (direct message: %s)",
    (isDirect) => {
      render(
        <ChannelHeader
          workspaceId="w1"
          channel={channel(isDirect)}
          title="Title"
        />,
      );
      expect(
        screen.getByText(`ai switch for ${isDirect ? "dm" : "general"}`),
      ).toBeVisible();
    },
  );
});
