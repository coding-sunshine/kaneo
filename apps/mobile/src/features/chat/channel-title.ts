/** "#name" for a channel; the other people's names for a direct message. */
export function channelTitle(
  channel: { name: string; isDirect: boolean; memberIds?: string[] },
  myId: string | undefined,
  members: { userId: string; name: string }[],
  selfLabel: string,
) {
  if (!channel.isDirect) return `#${channel.name}`;
  const names = (channel.memberIds ?? [])
    .filter((id) => id !== myId)
    .map((id) => members.find((m) => m.userId === id)?.name)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));
  return names.length ? names.join(", ") : selfLabel;
}
