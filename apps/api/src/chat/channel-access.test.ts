import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vite-plus/test";
import { assertChannelAccess, type ChannelAction } from "./channel-access";

const publicChannel = {
  isPrivate: false,
  isMember: false,
  archived: false,
  isDirect: false,
};
const statusOf = (run: () => void) => {
  try {
    run();
    return 200;
  } catch (error) {
    if (error instanceof HTTPException) return error.status;
    throw error;
  }
};
const check = (
  channel: Parameters<typeof assertChannelAccess>[0],
  action: ChannelAction,
) => statusOf(() => assertChannelAccess(channel, action));

const actions: ChannelAction[] = [
  "read",
  "join",
  "post",
  "manage",
  "ai",
  "invite",
  "leave",
];

describe("chat channel access", () => {
  it("answers 404 for a channel that is not in the workspace", () => {
    for (const action of actions) expect(check(undefined, action)).toBe(404);
  });

  it("hides a private channel from non-members on every action", () => {
    const hidden = { ...publicChannel, isPrivate: true };
    for (const action of actions) expect(check(hidden, action)).toBe(404);
  });

  it("lets any workspace member read and join a public channel", () => {
    expect(check(publicChannel, "read")).toBe(200);
    expect(check(publicChannel, "join")).toBe(200);
  });

  it("keeps posting, managing and inviting to channel members", () => {
    expect(check(publicChannel, "post")).toBe(403);
    expect(check(publicChannel, "manage")).toBe(403);
    expect(check(publicChannel, "invite")).toBe(403);
    const joined = { ...publicChannel, isMember: true };
    expect(check(joined, "post")).toBe(200);
    expect(check(joined, "manage")).toBe(200);
    expect(check(joined, "invite")).toBe(200);
  });

  it("lets members of a private channel use it", () => {
    const member = { ...publicChannel, isPrivate: true, isMember: true };
    for (const action of actions) expect(check(member, action)).toBe(200);
  });

  it("keeps an archived channel readable but closed to posts, joins and invites", () => {
    const archived = { ...publicChannel, isMember: true, archived: true };
    expect(check(archived, "read")).toBe(200);
    expect(check(archived, "manage")).toBe(200);
    expect(check(archived, "post")).toBe(409);
    expect(check(archived, "invite")).toBe(409);
    expect(check({ ...archived, isMember: false }, "join")).toBe(409);
  });

  it("shows a guest only the channels they were added to", () => {
    const outside = { ...publicChannel, guest: true };
    for (const action of actions) expect(check(outside, action)).toBe(404);
    const added = { ...outside, isMember: true };
    expect(check(added, "read")).toBe(200);
    expect(check(added, "post")).toBe(200);
    expect(check(added, "manage")).toBe(403);
    expect(check(added, "invite")).toBe(403);
  });

  it("lets any workspace member leave a public channel", () => {
    expect(check(publicChannel, "leave")).toBe(200);
  });

  it("hides a direct message from everyone outside it", () => {
    const direct = { ...publicChannel, isPrivate: true, isDirect: true };
    for (const action of actions) expect(check(direct, action)).toBe(404);
  });

  it("lets direct message members read and post but keeps the members fixed", () => {
    const direct = {
      ...publicChannel,
      isPrivate: true,
      isDirect: true,
      isMember: true,
    };
    expect(check(direct, "read")).toBe(200);
    expect(check(direct, "post")).toBe(200);
    for (const action of ["join", "manage", "invite", "leave"] as const)
      expect(check(direct, action)).toBe(403);
  });

  it("lets members who are not guests switch AI, in direct messages too", () => {
    expect(check(publicChannel, "ai")).toBe(403);
    expect(check({ ...publicChannel, isMember: true }, "ai")).toBe(200);
    const direct = {
      ...publicChannel,
      isPrivate: true,
      isDirect: true,
      isMember: true,
    };
    expect(check(direct, "ai")).toBe(200);
    expect(check({ ...direct, archived: true }, "ai")).toBe(200);
    expect(check({ ...direct, guest: true }, "ai")).toBe(403);
  });
});
