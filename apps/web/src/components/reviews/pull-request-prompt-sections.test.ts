import { expect, it } from "vite-plus/test";
import {
  failingCheckLines,
  unresolvedCommentLines,
} from "./pull-request-prompt-sections";

const check = (name: string, state: string, url = "") =>
  ({ name, state, url, durationSeconds: null }) as never;
const comment = (over: Record<string, unknown>) =>
  ({
    kind: "review_comment",
    resolved: false,
    path: "a.ts",
    line: 3,
    body: "fix",
    author: { login: "synthetic-reviewer" },
    ...over,
  }) as never;

it("lists only failed checks, linked when they have a page", () => {
  expect(
    failingCheckLines([
      check("Build", "failure", "http://ci/1"),
      check("Lint", "success"),
      check("Test", "failure"),
      check("Wait", "pending"),
    ]),
  ).toEqual(["- [Build](http://ci/1)", "- Test"]);
});

it("escapes brackets in names and parentheses in urls so the link cannot break", () => {
  expect(
    failingCheckLines([
      check("a](http://evil) [b", "failure", "http://ci/(1)"),
      check("x]y", "failure"),
    ]),
  ).toEqual(["- [a\\](http://evil) \\[b](http://ci/(1%29)", "- x\\]y"]);
});

it("lists inline comments from open threads, one line each, capped", () => {
  expect(
    unresolvedCommentLines([
      comment({ body: "a\n  b" }),
      comment({ resolved: true }),
      comment({ resolved: undefined }),
      comment({ kind: "comment" }),
      comment({ line: null, author: null, body: "x".repeat(250) }),
    ]),
  ).toEqual(["- a.ts:3 @synthetic-reviewer a b", `- a.ts ${"x".repeat(200)}…`]);
  const emoji = unresolvedCommentLines([comment({ body: "😀".repeat(201) })]);
  expect(emoji).toEqual([`- a.ts:3 @synthetic-reviewer ${"😀".repeat(200)}…`]);
  const many = Array.from({ length: 30 }, () => comment({}));
  const lines = unresolvedCommentLines(many);
  expect(lines).toHaveLength(21);
  expect(lines.at(-1)).toBe("- …and 10 more");
});

it("lists only the thread root, not a reply in the same open thread", () => {
  expect(
    unresolvedCommentLines([
      comment({ body: "fix the name", inReplyToId: null }),
      comment({ body: "Done", inReplyToId: 11 }),
    ]),
  ).toEqual(["- a.ts:3 @synthetic-reviewer fix the name"]);
});

it("caps thread roots and says how many were left out", () => {
  const lines = unresolvedCommentLines(
    Array.from({ length: 25 }, () => comment({ inReplyToId: null })),
  );
  expect(lines).toHaveLength(21);
  expect(lines.at(-1)).toBe("- …and 5 more");
});

it("says when thread state never arrived instead of listing nothing", () => {
  expect(
    unresolvedCommentLines([comment({ resolved: undefined, body: "maybe" })]),
  ).toEqual(["- Thread state could not be loaded"]);
});
