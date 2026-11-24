import { expect, it } from "vite-plus/test";
import {
  issueUrl,
  numberOnly,
  numberWithRepo,
  promptText,
  reviewUrl,
  titleLink,
} from "./pull-request-copy";

const pull = {
  owner: "acme",
  repo: "web",
  number: 7,
  title: 'Fix <b> & "quotes"',
  url: "https://github.com/acme/web/pull/7",
};

it("escapes the title in the html link and keeps a markdown fallback", () => {
  expect(titleLink(pull)).toEqual({
    html: '<a href="https://github.com/acme/web/pull/7">Fix &lt;b&gt; &amp; &quot;quotes&quot;</a>',
    text: '[Fix <b> & "quotes"](https://github.com/acme/web/pull/7)',
  });
});

it("formats the number with and without the repo", () => {
  expect(numberOnly(pull)).toBe("#7");
  expect(numberWithRepo(pull)).toBe("acme/web#7");
});

it("builds the review url from the workspace", () => {
  expect(reviewUrl("http://x", "w1", pull)).toBe(
    "http://x/dashboard/workspace/w1/reviews/acme/web/7",
  );
});

it("builds the issue url from the issue's own workspace and project", () => {
  expect(
    issueUrl("http://x", {
      workspaceId: "w2",
      taskId: "t1",
      title: "Fix it",
      team: { id: "p1" },
    }),
  ).toBe("http://x/dashboard/workspace/w2/project/p1/task/t1");
});

it("lays the prompt out as Linear does, with the branch and issue only when present", () => {
  const lines = { review: "R", pull: "P" };
  expect(promptText(lines)).toBe("R\nP");
  expect(
    promptText({
      ...lines,
      branch: "B",
      issue: { heading: "H", title: "Fix it", url: "http://x/t" },
    }),
  ).toBe("B\n\nR\nP\n\nH\n- [Fix it](http://x/t)");
});
