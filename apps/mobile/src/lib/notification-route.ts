/** Where a tapped notification leads, from its data. Null opens nothing. */
export function notificationRoute(data: Record<string, unknown> | undefined) {
  if (!data) return null;
  if (
    data.kind === "chat" &&
    typeof data.chatChannelId === "string" &&
    typeof data.workspaceId === "string"
  )
    return {
      pathname: "/chat/[channelId]" as const,
      params: {
        channelId: data.chatChannelId,
        workspaceId: data.workspaceId,
        ...(typeof data.messageId === "string"
          ? { messageId: data.messageId }
          : {}),
      },
    };
  if (typeof data.taskId === "string")
    return {
      pathname: "/task/[taskId]" as const,
      params: { taskId: data.taskId },
    };
  return null;
}
