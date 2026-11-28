import { describe, expect, it } from "vite-plus/test";
import type { GithubSearchPull } from "../github-api";
import { toSummary } from "./list-pull-requests";

const sha = "c".repeat(40);
const extension = `<!-- linear:extension {"version":1,"plugins":[{"plugin":"riskScore","level":3,"sha":"${sha}"}]} -->`;

const pull = (over: Partial<GithubSearchPull>) =>
  ({
    number: 1,
    title: "t",
    url: "https://github.com/acme/web/pull/1",
    state: "OPEN",
    isDraft: false,
    createdAt: "",
    updatedAt: "",
    closedAt: null,
    additions: 500,
    deletions: 10,
    comments: {
      totalCount: 1,
      nodes: [{ body: extension, authorAssociation: "MEMBER" }],
    },
    repository: { name: "web", owner: { login: "acme" } },
    commits: { nodes: [] },
    headRefOid: sha,
    body: "",
    reviews: {
      nodes: [
        { state: "COMMENTED", author: { login: "synthetic-reviewer" } },
        { state: "PENDING", author: { login: "synthetic-me" } },
      ],
    },
    files: {
      totalCount: 2,
      nodes: [
        { path: "src/a.ts", additions: 20, deletions: 10 },
        { path: "pnpm-lock.yaml", additions: 480, deletions: 0 },
      ],
    },
    ...over,
  }) as GithubSearchPull;

describe("toSummary review signals", () => {
  it("carries risk, submitted reviewers and generated lines to the list item", () => {
    expect(toSummary(pull({}))).toMatchObject({
      riskLevel: 3,
      reviewedBy: ["synthetic-reviewer"],
      generatedAdditions: 480,
      generatedDeletions: 0,
    });
  });

  it("leaves the pull request's own author out of reviewedBy", () => {
    const item = toSummary(
      pull({
        author: { login: "synthetic-author", avatarUrl: "" },
        reviews: {
          nodes: [
            { state: "COMMENTED", author: { login: "synthetic-author" } },
            { state: "APPROVED", author: { login: "synthetic-reviewer" } },
          ],
        },
      }),
    );
    expect(item.reviewedBy).toEqual(["synthetic-reviewer"]);
  });

  it("summarizes a lean search result without the detail fields", () => {
    const lean = pull({
      body: undefined,
      headRefOid: undefined,
      reviews: undefined,
      files: undefined,
      comments: { totalCount: 4 },
    });
    expect(toSummary(lean)).toMatchObject({
      comments: 4,
      riskLevel: null,
      reviewedBy: [],
    });
  });

  it("leaves generated lines out when the file list is cut off", () => {
    const item = toSummary(pull({ files: { totalCount: 80, nodes: [] } }));
    expect(item).not.toHaveProperty("generatedAdditions");
  });

  it("reads a risk block from the body or a member or bot, not from anyone else", () => {
    const comment = (
      authorAssociation: string,
      author?: { __typename: string },
    ) =>
      toSummary(
        pull({
          body: "",
          comments: {
            totalCount: 1,
            nodes: [{ body: extension, authorAssociation, author }],
          },
        }),
      ).riskLevel;
    expect(comment("NONE")).toBeNull();
    expect(comment("CONTRIBUTOR")).toBeNull();
    expect(comment("OWNER")).toBe(3);
    expect(comment("MEMBER")).toBe(3);
    expect(comment("COLLABORATOR")).toBe(3);
    expect(comment("NONE", { __typename: "Bot" })).toBe(3);
    expect(
      toSummary(
        pull({
          body: extension,
          comments: {
            totalCount: 1,
            nodes: [{ body: extension, authorAssociation: "NONE" }],
          },
        }),
      ).riskLevel,
    ).toBe(3);
  });
});
