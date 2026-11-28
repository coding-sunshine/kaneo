import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ReplyComposer } from "./reply-composer";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/mutations/chat/use-post-reply", () => ({
  usePostReply: () => ({ mutate: post, isPending: false }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  post.mockReset();
});

const box = () =>
  screen.getByLabelText("navigation:chat.replyLabel") as HTMLTextAreaElement;

describe("ReplyComposer", () => {
  it("posts once for fast repeated submits and a held Enter", () => {
    render(<ReplyComposer workspaceId="w1" channelId="c1" parentId="m1" />);
    fireEvent.change(box(), { target: { value: "once" } });
    fireEvent.keyDown(box(), { key: "Enter" });
    fireEvent.keyDown(box(), { key: "Enter" });
    fireEvent.submit(box().closest("form") as HTMLFormElement);
    expect(post).toHaveBeenCalledTimes(1);

    const [, options] = post.mock.calls[0] as [
      string,
      { onSuccess: () => void; onSettled: () => void },
    ];
    act(() => {
      options.onSuccess();
      options.onSettled();
    });
    fireEvent.change(box(), { target: { value: "twice" } });
    fireEvent.keyDown(box(), { key: "Enter", repeat: true });
    expect(post).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(post).toHaveBeenCalledTimes(2);
  });
});
