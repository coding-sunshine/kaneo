// Per-team icon colours, the way Linear tints each team.
const TEAM_COLORS = [
  "#4EA7FC",
  "#8B5CF6",
  "#26B5CE",
  "#F2994A",
  "#4CB782",
  "#EB5757",
  "#E5A100",
  "#D946A8",
] as const;

export function teamColor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TEAM_COLORS[hash % TEAM_COLORS.length];
}
