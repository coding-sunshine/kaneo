import type { Room } from "livekit-client";
import type { CallSession } from "@/store/call";

/**
 * Connects to the call's LiveKit room with the microphone on. The SDK loads
 * only here, so people who never join a call never download it.
 */
export async function joinLiveKitRoom(
  session: Pick<CallSession, "serverUrl" | "token">,
  show: (element: HTMLMediaElement) => void,
  onDisconnected: () => void,
): Promise<Room> {
  const { Room, RoomEvent, Track } = await import("livekit-client");
  const room = new Room();
  room
    .on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio)
        show(track.attach());
    })
    .on(RoomEvent.TrackUnsubscribed, (track) => {
      for (const element of track.detach()) element.remove();
    })
    .on(RoomEvent.LocalTrackPublished, (publication) => {
      if (publication.track?.kind !== Track.Kind.Video) return;
      const element = publication.track.attach();
      element.muted = true;
      show(element);
    })
    .on(RoomEvent.Disconnected, onDisconnected);
  await room.connect(session.serverUrl, session.token);
  await room.localParticipant.setMicrophoneEnabled(true);
  return room;
}
