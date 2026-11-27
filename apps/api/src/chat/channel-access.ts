import { HTTPException } from "hono/http-exception";

export type ChannelState = {
  isPrivate: boolean;
  isMember: boolean;
  archived: boolean;
  isDirect: boolean;
};

export type ChannelAction =
  | "read"
  | "join"
  | "post"
  | "manage"
  | "invite"
  | "leave";

const MEMBER_ONLY = new Set<ChannelAction>(["post", "manage", "invite"]);
const CLOSED_WHEN_ARCHIVED = new Set<ChannelAction>(["join", "post", "invite"]);
// A direct message is one conversation per set of people, so its members,
// name and archive state never change.
const FIXED_WHEN_DIRECT = new Set<ChannelAction>([
  "join",
  "manage",
  "invite",
  "leave",
]);

// One rule set for every channel route. A private channel answers like a
// missing one to non-members, so its name and existence never leak. Archived
// channels stay readable and can still be unarchived by their members.
export function assertChannelAccess(
  channel: ChannelState | undefined,
  action: ChannelAction,
): asserts channel is ChannelState {
  if (!channel || (channel.isPrivate && !channel.isMember))
    throw new HTTPException(404, { message: "Channel not found" });
  if (channel.isDirect && FIXED_WHEN_DIRECT.has(action))
    throw new HTTPException(403, {
      message: "Direct message members are fixed",
    });
  if (MEMBER_ONLY.has(action) && !channel.isMember)
    throw new HTTPException(403, { message: "Join the channel first" });
  if (CLOSED_WHEN_ARCHIVED.has(action) && channel.archived)
    throw new HTTPException(409, { message: "Channel is archived" });
}
