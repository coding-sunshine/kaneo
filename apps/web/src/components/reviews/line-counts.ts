import type { Category } from "@/components/reviews/file-categories";

type Counted = { filename: string; additions: number; deletions: number };
type Pair = { additions: number; deletions: number };

// Linear leaves these out of the header count.
const NOT_IMPLEMENTATION: Category[] = ["test", "documentation", "generated"];

/** Implementation-only and total counts; `generatedOnly` when every changed line is generated. */
export function lineCounts(
  files: Counted[],
  categoryOf: (path: string) => Category,
) {
  const total: Pair = { additions: 0, deletions: 0 };
  const implementation: Pair = { additions: 0, deletions: 0 };
  let changed = 0;
  let generated = 0;
  for (const file of files) {
    const category = categoryOf(file.filename);
    const lines = file.additions + file.deletions;
    total.additions += file.additions;
    total.deletions += file.deletions;
    changed += lines;
    if (category === "generated") generated += lines;
    if (!NOT_IMPLEMENTATION.includes(category)) {
      implementation.additions += file.additions;
      implementation.deletions += file.deletions;
    }
  }
  return {
    total,
    implementation,
    differs:
      implementation.additions !== total.additions ||
      implementation.deletions !== total.deletions,
    generatedOnly: changed > 0 && generated === changed,
  };
}
