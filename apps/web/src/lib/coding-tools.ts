import type { CopyablePull } from "@/components/reviews/pull-request-copy";

export const CODING_TOOLS_SETTINGS_PATH =
  "/dashboard/settings/account/preferences#coding-tools";

export type CodingTool = {
  id: string;
  name: string;
  urlTemplate: string;
  enabled: boolean;
  builtin?: boolean;
};

export const DEFAULT_CODING_TOOLS: CodingTool[] = [
  {
    id: "cursor",
    name: "Cursor",
    urlTemplate:
      "cursor://vscode.git/clone?url=https://github.com/{owner}/{repo}.git",
    enabled: true,
    builtin: true,
  },
  {
    id: "vscode",
    name: "VS Code",
    urlTemplate:
      "vscode://vscode.git/clone?url=https://github.com/{owner}/{repo}.git",
    enabled: true,
    builtin: true,
  },
  {
    id: "windsurf",
    name: "Windsurf",
    urlTemplate:
      "windsurf://vscode.git/clone?url=https://github.com/{owner}/{repo}.git",
    enabled: false,
    builtin: true,
  },
  {
    id: "zed",
    name: "Zed",
    urlTemplate: "zed://git/clone?url=https://github.com/{owner}/{repo}.git",
    enabled: false,
    builtin: true,
  },
  {
    id: "github-dev",
    name: "GitHub.dev",
    urlTemplate: "https://github.dev/{owner}/{repo}/pull/{number}",
    enabled: false,
    builtin: true,
  },
];

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;
const BLOCKED_SCHEMES = new Set(["javascript", "data", "vbscript"]);

export function isSafeCodingToolUrl(url: string): boolean {
  const trimmed = url.trim();
  const match = trimmed.match(SCHEME_RE);
  if (!match) return false;
  return !BLOCKED_SCHEMES.has(match[1].toLowerCase());
}

export function buildCodingToolUrl(
  template: string,
  pull: Pick<
    CopyablePull,
    "owner" | "repo" | "number" | "title" | "url" | "headRef"
  >,
): string | null {
  const trimmed = template.trim();
  if (!isSafeCodingToolUrl(trimmed)) return null;
  const resolved = trimmed
    .replaceAll("{url}", pull.url)
    .replaceAll("{owner}", encodeURIComponent(pull.owner))
    .replaceAll("{repo}", encodeURIComponent(pull.repo))
    .replaceAll("{number}", String(pull.number))
    .replaceAll("{branch}", encodeURIComponent(pull.headRef ?? ""))
    .replaceAll("{title}", encodeURIComponent(pull.title));
  return isSafeCodingToolUrl(resolved) ? resolved : null;
}

/** Keeps saved toggle states for built-in tools and drops malformed or unsafe custom entries. */
export function sanitizeCodingTools(saved: unknown): CodingTool[] {
  if (!Array.isArray(saved)) return DEFAULT_CODING_TOOLS;
  const savedById = new Map<string, Record<string, unknown>>();
  for (const item of saved) {
    if (item && typeof item === "object" && typeof item.id === "string") {
      savedById.set(item.id, item as Record<string, unknown>);
    }
  }

  const builtins: CodingTool[] = DEFAULT_CODING_TOOLS.map((tool) => {
    const match = savedById.get(tool.id);
    return {
      ...tool,
      enabled:
        typeof match?.enabled === "boolean" ? match.enabled : tool.enabled,
    };
  });
  const builtinIds = new Set(builtins.map((tool) => tool.id));

  const custom: CodingTool[] = [];
  for (const item of saved) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.id !== "string" ||
      !entry.id ||
      builtinIds.has(entry.id) ||
      typeof entry.name !== "string" ||
      !entry.name.trim() ||
      typeof entry.urlTemplate !== "string" ||
      !isSafeCodingToolUrl(entry.urlTemplate)
    ) {
      continue;
    }
    custom.push({
      id: entry.id,
      name: entry.name.trim(),
      urlTemplate: entry.urlTemplate.trim(),
      enabled: entry.enabled !== false,
    });
  }

  return [...builtins, ...custom];
}
