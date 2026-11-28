/**
 * The app path that opens a chat message in its channel. A path, not a full
 * address: the web app may run on any origin, and chat shows it as a link.
 */
export const messageLink = (
  workspaceId: string,
  channelId: string,
  messageId: string,
) =>
  `/dashboard/workspace/${workspaceId}/channels/${channelId}?messageId=${messageId}`;
