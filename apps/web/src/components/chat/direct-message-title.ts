/** A direct message is named after the other people in it. */
export function directMessageTitle(
  memberIds: string[],
  viewerId: string | undefined,
  names: ReadonlyMap<string, string>,
  unknownName: string,
) {
  const others = memberIds.filter((id) => id !== viewerId);
  return (others.length > 0 ? others : memberIds)
    .map((id) => names.get(id) ?? unknownName)
    .join(", ");
}
