import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CallButton } from "./call-button";

const state = vi.hoisted(() => ({ hasCalls: false, start: vi.fn() }));
vi.mock("@/hooks/queries/call/use-has-calls", () => ({
  useHasCalls: () => state.hasCalls,
}));
vi.mock("@/hooks/mutations/chat/use-start-call", () => ({
  useStartCall: () => ({ mutate: state.start, isPending: false }),
}));

const channel = {
  id: "channel-1",
  name: "pair",
  isMember: true,
  archivedAt: null,
};
afterEach(cleanup);

describe("CallButton", () => {
  it("shows no call button while the server has no call service", () => {
    state.hasCalls = false;
    render(<CallButton workspaceId="workspace-1" channel={channel} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("starts a call in a channel the user belongs to", () => {
    state.hasCalls = true;
    render(<CallButton workspaceId="workspace-1" channel={channel} />);
    screen.getByRole("button", { name: "navigation:chat.startCall" }).click();
    expect(state.start).toHaveBeenCalled();
  });

  it("hides the button outside the channel and in archived channels", () => {
    state.hasCalls = true;
    const { rerender } = render(
      <CallButton
        workspaceId="workspace-1"
        channel={{ ...channel, isMember: false }}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    rerender(
      <CallButton
        workspaceId="workspace-1"
        channel={{ ...channel, archivedAt: "2026-01-01T00:00:00.000Z" }}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
