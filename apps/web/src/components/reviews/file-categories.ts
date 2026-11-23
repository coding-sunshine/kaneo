export const CATEGORIES = [
  "implementation",
  "test",
  "documentation",
  "generated",
  "agentGuidance",
  "localization",
  "assets",
] as const;
export type Category = (typeof CATEGORIES)[number];

// .gitattributes spelling of each category.
const REVIEW_ATTR: Record<Category, string> = {
  implementation: "review-implementation",
  test: "review-test",
  documentation: "review-documentation",
  generated: "review-generated",
  agentGuidance: "review-agent-guidance",
  localization: "review-localization",
  assets: "review-assets",
};
// GitHub linguist attributes that also place a file.
const LINGUIST_ATTR: Partial<Record<Category, string>> = {
  generated: "linguist-generated",
  documentation: "linguist-documentation",
};

type Rule = { test: RegExp; attrs: [name: string, on: boolean | null][] };
export type CategoryRules = Rule[];

// Glob to regex: `*` and `?` stay inside a segment, `**` crosses them. A pattern
// without a slash matches the file name at any depth.
// ponytail: no `[...]` classes or `\` escapes, add them when a repo needs them.
function globToRegex(pattern: string) {
  const anchored =
    pattern.startsWith("/") || pattern.slice(0, -1).includes("/");
  const body = pattern
    .replace(/^\//, "")
    .replace(/\/$/, "/**")
    .split(/(\*\*\/|\*\*|\*|\?)/)
    .map((part) => {
      if (part === "**/") return "(?:.*/)?";
      if (part === "**") return ".*";
      if (part === "*") return "[^/]*";
      if (part === "?") return "[^/]";
      return part.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return new RegExp(`^${anchored ? "" : "(?:.*/)?"}${body}$`);
}

/** Reads the attribute lines of a .gitattributes file; later lines win. */
export function parseGitattributes(text: string): CategoryRules {
  const rules: CategoryRules = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [pattern, ...tokens] = line.split(/\s+/);
    const attrs: Rule["attrs"] = [];
    for (const token of tokens) {
      const [, minus, name, value] =
        token.match(/^(-|!)?([^=]+)(?:=(.*))?$/) ?? [];
      if (!name) continue;
      if (minus === "!") attrs.push([name, null]);
      else
        attrs.push([
          name,
          minus ? false : value === undefined || value === "true",
        ]);
    }
    if (attrs.length) rules.push({ test: globToRegex(pattern), attrs });
  }
  return rules;
}

// ponytail: path heuristics for repos without review-* attributes, a fixed list
// that misses odd layouts; extend it or set the attributes in .gitattributes.
const HEURISTICS: [Category, RegExp][] = [
  [
    "generated",
    /(^|\/)(__snapshots__|dist)\/|\.generated\.|\.min\.(js|css)$|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|composer\.lock|poetry\.lock|uv\.lock)$/,
  ],
  ["test", /\.(test|spec)\.|(^|\/)(__tests__|tests?)\//],
  ["documentation", /\.mdx?$|(^|\/)docs\//],
];

/** The category of a path: the repo's attributes first, then the path heuristics. */
export function categorize(path: string, rules: CategoryRules): Category {
  const state = new Map<string, boolean | null>();
  for (const rule of rules) {
    if (!rule.test.test(path)) continue;
    for (const [name, on] of rule.attrs) state.set(name, on);
  }
  for (const category of CATEGORIES) {
    if (state.get(REVIEW_ATTR[category]) === true) return category;
  }
  for (const [category, name] of Object.entries(LINGUIST_ATTR)) {
    if (state.get(name!) === true) return category as Category;
  }
  for (const [category, pattern] of HEURISTICS) {
    const off = [REVIEW_ATTR[category], LINGUIST_ATTR[category] ?? ""].some(
      (name) => state.get(name) === false,
    );
    if (!off && pattern.test(path)) return category;
  }
  return "implementation";
}
