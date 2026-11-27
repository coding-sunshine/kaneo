import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vite-plus/test";
import { assertChannelAccess, type ChannelAction } from "./channel-access";

const publicChannel = { isPrivate: false, isMember: false, archived: false };
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

const actions: ChannelAction[] = ["read", "join", "post", "manage", "invite"];

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
    const member = { isPrivate: true, isMember: true, archived: false };
    for (const action of actions) expect(check(member, action)).toBe(200);
  });

  it("keeps an archived channel readable but closed to posts, joins and invites", () => {
    const archived = { isPrivate: false, isMember: true, archived: true };
    expect(check(archived, "read")).toBe(200);
    expect(check(archived, "manage")).toBe(200);
    expect(check(archived, "post")).toBe(409);
    expect(check(archived, "invite")).toBe(409);
    expect(check({ ...archived, isMember: false }, "join")).toBe(409);
  });
});
