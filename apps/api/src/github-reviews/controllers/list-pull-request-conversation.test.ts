import { describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  resolution: vi.fn(),
}));

vi.mock("../with-github-token", () => ({
  withGithubToken: (_userId: string, call: (token: string) => unknown) =>
    call("token"),
}));
vi.mock("../github-api", () => ({
  listIssueComments: async () => [],
  listReviews: async () => [],
  listReviewComments: async () => [
    {
      id: 11,
      user: { login: "synthetic-reviewer", avatar_url: "" },
      body: "Rename this",
      path: "src/a.ts",
      line: 3,
      original_line: 3,
      side: "RIGHT",
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: 12,
      user: { login: "synthetic-reviewer", avatar_url: "" },
      body: "Done",
      path: "src/a.ts",
      line: 4,
      original_line: 4,
      side: "RIGHT",
      created_at: "2026-01-02T00:00:00Z",
    },
  ],
  listReviewThreadResolution: mocks.resolution,
}));

import { listPullRequestConversation } from "./list-pull-request-conversation";

describe("listPullRequestConversation resolved flag", () => {
  it("marks inline comments with their thread's resolved state", async () => {
    mocks.resolution.mockResolvedValue(
      new Map([
        ["11", true],
        ["12", false],
      ]),
    );
    const entries = await listPullRequestConversation("u", "acme", "web", "7");
    expect(
      entries.map((entry) => ("resolved" in entry ? entry.resolved : "n/a")),
    ).toEqual([true, false]);
  });

  it("leaves the flag out when GitHub's thread lookup fails", async () => {
    mocks.resolution.mockRejectedValue(new Error("graphql down"));
    const entries = await listPullRequestConversation("u", "acme", "web", "7");
    expect(
      entries.map((entry) => ("resolved" in entry ? entry.resolved : "n/a")),
    ).toEqual([undefined, undefined]);
  });
});
