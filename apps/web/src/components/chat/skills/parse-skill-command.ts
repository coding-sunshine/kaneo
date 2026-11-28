/** `/name rest` as the skill name and its input; null for anything else. */
export function parseSkillCommand(text: string) {
  const match = text
    .trim()
    .match(/^\/([a-z0-9][a-z0-9-]{0,31})(?:\s+([\s\S]*))?$/);
  if (!match?.[1]) return null;
  return { name: match[1], input: match[2]?.trim() || undefined };
}
