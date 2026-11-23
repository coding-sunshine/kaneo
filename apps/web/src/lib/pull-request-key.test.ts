import { expect, it } from "vite-plus/test";
import { parsePullRequestKey, pullRequestKey } from "./pull-request-key";

it("round-trips a pull request through its key", () => {
  const ref = { owner: "Acme-Inc", repo: "web.app", number: "7" };
  expect(pullRequestKey(ref)).toBe("Acme-Inc/web.app#7");
  expect(parsePullRequestKey("Acme-Inc/web.app#7")).toEqual(ref);
});

it("rejects ids that are not a pull request", () => {
  expect(parsePullRequestKey("abc123")).toBeNull();
  expect(parsePullRequestKey("a/b#x")).toBeNull();
});
