import type { WSContext } from "hono/ws";
import { findChannelReaders } from "./chat-channel-readers";

export type ChatConnection = {
  ws: WSContext;
  userId: string;
  workspaceId: string;
  sessionId: string | null;
  apiKeyId?: string;
};

/** Sockets on this instance that watch one chat channel, keyed by channel id. */
const chatConnections = new Map<string, Set<ChatConnection>>();

export function addChatConnection(
  channelId: string,
  ws: WSContext,
  userId: string,
  workspaceId: string,
  sessionId: string | null = null,
  apiKeyId?: string,
) {
  const conn: ChatConnection = {
    ws,
    userId,
    workspaceId,
    sessionId,
    ...(apiKeyId ? { apiKeyId } : {}),
  };
  const connections = chatConnections.get(channelId) ?? new Set();
  chatConnections.set(channelId, connections.add(conn));
  return conn;
}

export function removeChatConnection(channelId: string, conn: ChatConnection) {
  const connections = chatConnections.get(channelId);
  if (!connections) return;
  connections.delete(conn);
  if (connections.size === 0) chatConnections.delete(channelId);
}

export function listChatConnections() {
  return [...chatConnections.values()].flatMap((connections) => [
    ...connections,
  ]);
}

export function closeChatConnections(
  matches: (conn: ChatConnection) => boolean,
  code: number,
  reason: string,
) {
  for (const [channelId, connections] of chatConnections)
    for (const conn of [...connections]) {
      if (!matches(conn)) continue;
      removeChatConnection(channelId, conn);
      try {
        conn.ws.close(code, reason);
      } catch {
        /* Already closed. */
      }
    }
}

// Access is checked again on every delivery, so a member who left a private
// channel, or lost the workspace while a revocation was missed, gets nothing.
export async function deliverToLocalChatConnections(
  channelId: string,
  message: { type: string; channelId: string },
) {
  const connections = chatConnections.get(channelId);
  if (!connections) return;
  const recipients = [...connections];
  const access = await findChannelReaders(channelId, [
    ...new Set(recipients.map((conn) => conn.userId)),
  ]);
  if (!access) return;
  const payload = JSON.stringify(message);
  for (const conn of recipients) {
    if (!chatConnections.get(channelId)?.has(conn)) continue;
    if (
      conn.workspaceId !== access.workspaceId ||
      !access.readers.has(conn.userId)
    ) {
      removeChatConnection(channelId, conn);
      try {
        conn.ws.close(1008, "Channel access revoked");
      } catch {
        /* Already closed. */
      }
      continue;
    }
    try {
      conn.ws.send(payload);
    } catch {
      removeChatConnection(channelId, conn);
    }
  }
}
