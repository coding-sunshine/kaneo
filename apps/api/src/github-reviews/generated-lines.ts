// ponytail: copy of GENERATED_PATH in web file-categories.ts (the API cannot
// import web); .gitattributes rules are web-only. generated-lines.test.ts
// fails if the two patterns drift.
export const GENERATED_PATH =
  /(^|\/)(__snapshots__|dist)\/|\.generated\.|\.min\.(js|css)$|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|composer\.lock|poetry\.lock|uv\.lock)$/;

export type FileStat = { path: string; additions: number; deletions: number };

/** Lines in generated files, or null when the fetched page does not cover every file. */
export function generatedLines(
  files: { totalCount: number; nodes: FileStat[] } | undefined,
) {
  if (!files || files.nodes.length < files.totalCount) return null;
  let additions = 0;
  let deletions = 0;
  for (const file of files.nodes) {
    if (!GENERATED_PATH.test(file.path)) continue;
    additions += file.additions;
    deletions += file.deletions;
  }
  return { additions, deletions };
}
