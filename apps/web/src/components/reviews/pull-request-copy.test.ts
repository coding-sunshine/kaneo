import { expect, it } from "vite-plus/test";
import {
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
const labels = { title: "T", url: "U", branch: "B" };

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

it("includes the branch and body only when present", () => {
  expect(promptText(pull, labels)).toBe("T\nU");
  expect(promptText({ ...pull, headRef: "feat", body: " hi " }, labels)).toBe(
    "T\nU\nB\n\nhi",
  );
});
