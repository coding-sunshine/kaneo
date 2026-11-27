import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { SearchResult } from "@/components/search-page/types";
import { SearchResultGroup } from "./search-result-group";

const message = (patch: Partial<SearchResult>) =>
  ({
    id: "message-1",
    type: "message",
    title: "launch-room",
    content: "the rollout starts at noon",
    channelId: "channel-1",
    isDirect: false,
    userName: "Test author",
    createdAt: "2026-01-02T03:04:05.000Z",
    relevanceScore: 3,
    ...patch,
  }) as SearchResult;

afterEach(cleanup);

describe("SearchResultGroup", () => {
  it("heads the messages, names channels and direct messages, and opens a result", () => {
    const onOpen = vi.fn();
    const channel = message({});
    const direct = message({
      id: "message-2",
      title: "",
      content: "can you check the rollout",
      channelId: "channel-2",
      isDirect: true,
    });
    render(
      <SearchResultGroup
        type="message"
        items={[channel, direct]}
        onOpen={onOpen}
      />,
    );

    expect(
      screen.getByRole("region", { name: "navigation:search.groups.message" }),
    ).toBeInTheDocument();
    expect(screen.getByText("the rollout starts at noon")).toBeInTheDocument();
    expect(
      screen.getByText("workspace:search.directMessage"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("#launch-room"));
    expect(onOpen).toHaveBeenCalledWith(channel);
  });
});
