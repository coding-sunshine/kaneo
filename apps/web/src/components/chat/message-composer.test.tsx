import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { MessageComposer } from "./message-composer";

const state = vi.hoisted(() => ({
  drafts: [] as { channelId: string; body: string; updatedAt: string }[],
  saveDraft: vi.fn(async () => ({})),
  post: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/fetchers/chat/drafts", () => ({
  getDrafts: async () => state.drafts,
  saveDraft: state.saveDraft,
}));
vi.mock("@/hooks/mutations/chat/use-post-message", () => ({
  usePostMessage: () => ({ mutate: state.post, isPending: false }),
}));

const composer = (channelId: string) => (
  <MessageComposer workspaceId="w1" channelId={channelId} channelName="x" />
);

function renderWith(queryClient: QueryClient, channelId: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      {composer(channelId)}
    </QueryClientProvider>,
  );
}

const box = () =>
  screen.getByLabelText("navigation:chat.messageLabel") as HTMLTextAreaElement;

describe("MessageComposer drafts", () => {
  afterEach(() => {
    cleanup();
    state.drafts = [];
    state.saveDraft.mockClear();
    state.post.mockReset();
  });

  it("opens with the saved draft of its own channel only", async () => {
    state.drafts = [
      { channelId: "x", body: "half written", updatedAt: "2026-01-01" },
    ];
    renderWith(new QueryClient(), "x");
    await waitFor(() => expect(box().value).toBe("half written"));

    cleanup();
    renderWith(new QueryClient(), "y");
    await act(async () => {});
    expect(box().value).toBe("");
  });

  it("keeps typed text when leaving the channel and coming back", async () => {
    const queryClient = new QueryClient();
    const view = renderWith(queryClient, "x");
    await act(async () => {});
    fireEvent.change(box(), { target: { value: "half written" } });

    view.rerender(
      <QueryClientProvider client={queryClient}>
        {composer("y")}
      </QueryClientProvider>,
    );
    // Leaving the channel saves its draft at once.
    expect(state.saveDraft).toHaveBeenCalledWith(
      { workspaceId: "w1", channelId: "x" },
      "half written",
    );
    expect(box().value).toBe("");

    view.rerender(
      <QueryClientProvider client={queryClient}>
        {composer("x")}
      </QueryClientProvider>,
    );
    expect(box().value).toBe("half written");
  });

  it("clears the draft when the message is sent", async () => {
    const queryClient = new QueryClient();
    state.post.mockImplementation((_body, options) => options.onSuccess());
    renderWith(queryClient, "x");
    await act(async () => {});
    fireEvent.change(box(), { target: { value: "done" } });
    fireEvent.keyDown(box(), { key: "Enter" });

    await waitFor(() => expect(state.post).toHaveBeenCalled());
    expect(box().value).toBe("");
    cleanup();
    renderWith(queryClient, "x");
    await act(async () => {});
    expect(box().value).toBe("");
  });
});
