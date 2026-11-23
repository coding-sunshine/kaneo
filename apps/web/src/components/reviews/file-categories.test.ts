import { describe, expect, it } from "vite-plus/test";
import { categorize, parseGitattributes } from "./file-categories";

describe("categorize", () => {
  it("falls back to path heuristics", () => {
    const none = parseGitattributes("");
    expect(categorize("src/a.test.ts", none)).toBe("test");
    expect(categorize("docs/intro.txt", none)).toBe("documentation");
    expect(categorize("README.md", none)).toBe("documentation");
    expect(categorize("pnpm-lock.yaml", none)).toBe("generated");
    expect(categorize("src/a.ts", none)).toBe("implementation");
  });

  it("reads review-* and linguist attributes", () => {
    const rules = parseGitattributes(
      [
        "# comment",
        "tests/** review-test",
        "generated/** linguist-generated=true",
        "*.l10n.json review-localization",
        "vendor/** linguist-documentation",
      ].join("\n"),
    );
    expect(categorize("tests/deep/x.ts", rules)).toBe("test");
    expect(categorize("generated/api.ts", rules)).toBe("generated");
    expect(categorize("a/b/en.l10n.json", rules)).toBe("localization");
    expect(categorize("vendor/x.c", rules)).toBe("documentation");
  });

  it("removes with -attr or attr=false, later lines winning", () => {
    const rules = parseGitattributes(
      [
        "**/*.stories.tsx review-test",
        "*.stories.tsx -review-test",
        "*.generated.ts linguist-generated=false",
        "docs/** review-documentation",
        "docs/keep.ts review-documentation=false",
      ].join("\n"),
    );
    expect(categorize("ui/a.stories.tsx", rules)).toBe("implementation");
    expect(categorize("src/x.generated.ts", rules)).toBe("implementation");
    expect(categorize("docs/keep.ts", rules)).toBe("implementation");
    expect(categorize("docs/a.ts", rules)).toBe("documentation");
  });

  it("anchors patterns that contain a slash", () => {
    const rules = parseGitattributes(
      "packages/builder/**/*.gen.ts linguist-generated=true",
    );
    expect(categorize("packages/builder/src/a.gen.ts", rules)).toBe(
      "generated",
    );
    expect(categorize("other/packages/builder/src/a.gen.ts", rules)).toBe(
      "implementation",
    );
  });
});
