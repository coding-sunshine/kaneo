export const SLASH_COMMANDS = ["remind", "status", "ticket"] as const;
export type SlashCommandName = (typeof SLASH_COMMANDS)[number];

/**
 * Whether a composer line is a slash command: "/word" at the start, then a
 * space or nothing. Anything else, a path like /usr/bin too, is a message.
 */
export function readSlashCommand(
  text: string,
): { name: SlashCommandName } | { unknown: string } | null {
  const name = /^\/([a-z]+)(?:\s|$)/i.exec(text.trim())?.[1]?.toLowerCase();
  if (!name) return null;
  return (SLASH_COMMANDS as readonly string[]).includes(name)
    ? { name: name as SlashCommandName }
    : { unknown: name };
}
