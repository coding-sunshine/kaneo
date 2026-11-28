export type BroadcastMention = "channel" | "here";

// A word of its own, so an address such as ops@here.example names nobody.
const BROADCAST = /(?<![\p{L}\p{N}_.@-])@(channel|here)(?![\p{L}\p{N}_@-])/gu;

/**
 * Whether a message calls on the whole channel: `@channel` for every member,
 * `@here` for the members who are around. `@channel` wins when both appear.
 */
export function findBroadcastMention(body: string): BroadcastMention | null {
  let found: BroadcastMention | null = null;
  for (const match of body.matchAll(BROADCAST)) {
    if (match[1] === "channel") return "channel";
    found = "here";
  }
  return found;
}
