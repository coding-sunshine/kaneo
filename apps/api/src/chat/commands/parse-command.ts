export type ChatCommand =
  | { name: "remind"; delayMs: number; note: string }
  | { name: "status"; text: string | null }
  | { name: "ticket"; title: string };

/** Which command was misused, or "unknown" for a name there is none of. */
export type ChatCommandError = { error: ChatCommand["name"] | "unknown" };

const MINUTE = 60_000;
const UNITS: Record<string, number> = {
  m: MINUTE,
  min: MINUTE,
  mins: MINUTE,
  minute: MINUTE,
  minutes: MINUTE,
  h: 60 * MINUTE,
  hr: 60 * MINUTE,
  hrs: 60 * MINUTE,
  hour: 60 * MINUTE,
  hours: 60 * MINUTE,
  d: 24 * 60 * MINUTE,
  day: 24 * 60 * MINUTE,
  days: 24 * 60 * MINUTE,
  w: 7 * 24 * 60 * MINUTE,
  week: 7 * 24 * 60 * MINUTE,
  weeks: 7 * 24 * 60 * MINUTE,
};
export const MAX_REMIND_MS = 365 * 24 * 60 * MINUTE;
const NOTE_MAX = 200;
const STATUS_MAX = 100;
const TITLE_MAX = 200;

// "in 1 hour", "me in 30 minutes to check", "in an hour", "in 2d review".
const REMIND =
  /^(?:me\s+)?in\s+(\d{1,6}|an?)\s*([a-z]+)\b\s*(?:to\s+)?([\s\S]*)$/i;

/** Reads a chat line that starts with a slash. No lookup, no side effect. */
export function parseCommand(text: string): ChatCommand | ChatCommandError {
  const match = /^\/([a-z]+)(?:\s+([\s\S]*))?$/i.exec(text.trim());
  const name = match?.[1]?.toLowerCase();
  const rest = match?.[2]?.trim() ?? "";
  switch (name) {
    case "remind": {
      const [, amount = "", unit = "", note = ""] = REMIND.exec(rest) ?? [];
      const count = /^an?$/i.test(amount) ? 1 : Number(amount);
      const delayMs = count * (UNITS[unit.toLowerCase()] ?? 0);
      if (!delayMs || delayMs > MAX_REMIND_MS || note.length > NOTE_MAX)
        return { error: "remind" };
      return { name, delayMs, note: note.trim() };
    }
    case "status":
      if (rest.length > STATUS_MAX) return { error: "status" };
      return {
        name,
        text: !rest || rest.toLowerCase() === "clear" ? null : rest,
      };
    case "ticket":
      if (!rest || rest.length > TITLE_MAX) return { error: "ticket" };
      return { name, title: rest };
    default:
      return { error: "unknown" };
  }
}
