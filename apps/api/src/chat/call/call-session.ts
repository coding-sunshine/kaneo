import { eq } from "drizzle-orm";
import db from "../../database";
import { userTable } from "../../database/schema";
import { readCallConfig } from "./call-config";
import { createLiveKitToken } from "./livekit-token";

// The room is the channel's, so everyone who joins its call meets there.
export const callRoomName = (channelId: string) => `chat-${channelId}`;

export async function createCallSession(channelId: string, userId: string) {
  const config = readCallConfig();
  if (!config) throw new Error("Calls are off");
  const [user] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId));
  const name = user?.name ?? "";
  const roomName = callRoomName(channelId);
  const token = createLiveKitToken(config, {
    identity: userId,
    name,
    room: roomName,
  });
  return { name, session: { serverUrl: config.url, roomName, token } };
}
