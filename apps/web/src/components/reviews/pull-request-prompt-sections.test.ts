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
    author: { login: "bo" },
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
  ).toEqual(["- a.ts:3 @bo a b", `- a.ts ${"x".repeat(200)}…`]);
  const emoji = unresolvedCommentLines([comment({ body: "😀".repeat(201) })]);
  expect(emoji).toEqual([`- a.ts:3 @bo ${"😀".repeat(200)}…`]);
  const many = Array.from({ length: 30 }, () => comment({}));
  expect(unresolvedCommentLines(many)).toHaveLength(20);
});
