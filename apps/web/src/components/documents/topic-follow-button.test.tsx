import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Topic } from "@/fetchers/topic/topics";
import { TopicFollowButton } from "./topic-follow-button";

const mocks = vi.hoisted(() => ({ setTopicFollowed: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/topic/topics", () => ({
  setTopicFollowed: mocks.setTopicFollowed,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const TOPICS = "navigation:documents.topics";
const show = (following: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TopicFollowButton
        topic={{ id: "topic-1", workspaceId: "ws", following } as Topic}
      />
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TopicFollowButton", () => {
  it("offers Follow to somebody who does not follow the topic", async () => {
    mocks.setTopicFollowed.mockResolvedValue({});
    show(false);

    expect(screen.queryByRole("button", { name: `${TOPICS}.unfollow` })).toBe(
      null,
    );
    fireEvent.click(screen.getByRole("button", { name: `${TOPICS}.follow` }));
    await waitFor(() =>
      expect(mocks.setTopicFollowed).toHaveBeenCalledWith(
        "ws",
        "topic-1",
        true,
      ),
    );
  });

  it("offers Unfollow to a follower", async () => {
    mocks.setTopicFollowed.mockResolvedValue({});
    show(true);

    fireEvent.click(screen.getByRole("button", { name: `${TOPICS}.unfollow` }));
    await waitFor(() =>
      expect(mocks.setTopicFollowed).toHaveBeenCalledWith(
        "ws",
        "topic-1",
        false,
      ),
    );
  });
});
