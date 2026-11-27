import { withoutOutboundTelemetry } from "../../utils/sensitive-outbound";
import { readCallConfig } from "./call-config";
import { callRoomName } from "./call-session";
import { createRoomAdminToken } from "./livekit-token";

const TIMEOUT_MS = 5000;

// LiveKit's server API speaks HTTP on the same host as its WebSocket URL.
const httpUrl = (url: string) => url.replace(/^ws(s?):\/\//, "http$1://");

/**
 * Drops one person from a channel's call right away, so a member who leaves
 * or loses the workspace stops hearing it. Nobody in the room is not an error.
 */
export async function removeFromCall(channelId: string, userId: string) {
  const config = readCallConfig();
  if (!config) return;
  const room = callRoomName(channelId);
  try {
    const response = await withoutOutboundTelemetry(() =>
      fetch(
        `${httpUrl(config.url).replace(/\/$/, "")}/twirp/livekit.RoomService/RemoveParticipant`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${createRoomAdminToken(config, room)}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ room, identity: userId }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      ),
    );
    void response.body?.cancel().catch(() => {});
    if (!response.ok && response.status !== 404)
      console.error(
        `Failed to remove a member from the call in channel ${channelId}: HTTP ${response.status}`,
      );
  } catch {
    console.error(
      `Failed to remove a member from the call in channel ${channelId}`,
    );
  }
}
