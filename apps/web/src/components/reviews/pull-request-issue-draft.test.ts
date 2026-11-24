import { describe, expect, it } from "vite-plus/test";
import { buildPullRequestIssueDraft } from "./pull-request-issue-draft";

describe("buildPullRequestIssueDraft", () => {
  it("carries the title, a link back and the pull request", () => {
    expect(
      buildPullRequestIssueDraft({
        title: "Add thing",
        url: "https://github.com/acme/web/pull/7",
        status: "open",
      }),
    ).toEqual({
      title: "Add thing",
      description: "[Add thing](https://github.com/acme/web/pull/7)",
      pullRequest: {
        url: "https://github.com/acme/web/pull/7",
        status: "open",
      },
    });
  });
});
