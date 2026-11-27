import { describe, expect, it, vi } from "vite-plus/test";

const { info } = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: { info } }));
vi.mock("i18next", () => ({
  default: {
    t: (key: string, values?: object) =>
      `${key} ${JSON.stringify(values ?? {})}`,
  },
}));

import { ringIncomingCall } from "./ring-incoming-call";

describe("ringIncomingCall", () => {
  it("rings with the caller and channel and joins on answer", () => {
    const join = vi.fn();
    ringIncomingCall(
      {
        workspaceId: "workspace-1",
        channelId: "channel-1",
        channelName: "pair",
        isDirect: false,
        callerName: "Test caller",
      },
      join,
    );
    const [title, options] = info.mock.calls[0] ?? [];
    expect(title).toContain("navigation:chat.incomingCall");
    expect(title).toContain("Test caller");
    expect(options.description).toContain("pair");
    expect(options.timeout).toBe(30_000);
    options.action.onClick();
    expect(join).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      channelName: "pair",
    });
  });

  it("names only the caller for a direct message", () => {
    info.mockClear();
    ringIncomingCall(
      {
        workspaceId: "workspace-1",
        channelId: "channel-2",
        channelName: "",
        isDirect: true,
        callerName: "Test caller",
      },
      vi.fn(),
    );
    const [title, options] = info.mock.calls[0] ?? [];
    expect(title).toContain("Test caller");
    expect(options.description).toBeUndefined();
  });
});
