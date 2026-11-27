import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useCallStore } from "@/store/call";
import { CallRoom } from "./call-room";

// A fake LiveKit client: the test never reaches a media server.
const fake = vi.hoisted(() => ({
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  setMicrophoneEnabled: vi.fn(async () => {}),
  setCameraEnabled: vi.fn(async () => {}),
}));
vi.mock("livekit-client", () => ({
  RoomEvent: {
    TrackSubscribed: "trackSubscribed",
    TrackUnsubscribed: "trackUnsubscribed",
    LocalTrackPublished: "localTrackPublished",
    Disconnected: "disconnected",
  },
  Track: { Kind: { Video: "video", Audio: "audio" } },
  Room: class {
    localParticipant = {
      setMicrophoneEnabled: fake.setMicrophoneEnabled,
      setCameraEnabled: fake.setCameraEnabled,
    };
    connect = fake.connect;
    disconnect = fake.disconnect;
    on() {
      return this;
    }
  },
}));

const session = {
  workspaceId: "workspace-1",
  channelId: "channel-1",
  channelName: "pair",
  serverUrl: "wss://calls.example.test",
  roomName: "chat-channel-1",
  token: "fake-token",
};

afterEach(() => {
  cleanup();
  useCallStore.setState({ session: null });
});

describe("CallRoom", () => {
  it("renders nothing without a call", () => {
    const { container } = render(<CallRoom />);
    expect(container).toBeEmptyDOMElement();
  });

  it("joins the room with the token and leaves on hang up", async () => {
    render(<CallRoom />);
    await act(async () => useCallStore.setState({ session }));

    expect(fake.connect).toHaveBeenCalledWith(
      "wss://calls.example.test",
      "fake-token",
    );
    expect(fake.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    expect(screen.getByRole("region", { name: /pair/ })).toBeTruthy();

    await act(async () => {
      screen.getByRole("button", { name: "navigation:chat.camera" }).click();
    });
    expect(fake.setCameraEnabled).toHaveBeenCalledWith(true);

    await act(async () => {
      screen.getByRole("button", { name: "navigation:chat.leaveCall" }).click();
    });
    expect(fake.disconnect).toHaveBeenCalled();
    expect(useCallStore.getState().session).toBeNull();
  });
});
