import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { listReviewThreadResolution, searchPullRequests } from "./github-api";

const respond = (data: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify({ data })));

const queryOf = (fetchMock: ReturnType<typeof respond>) =>
  JSON.parse(fetchMock.mock.calls[0]?.[1].body).query as string;

afterEach(() => vi.unstubAllGlobals());

describe("listReviewThreadResolution", () => {
  it("keys each comment by its string full database id", async () => {
    const fetchMock = respond({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              {
                isResolved: true,
                comments: { nodes: [{ fullDatabaseId: "3000000001" }] },
              },
              {
                isResolved: false,
                comments: { nodes: [{ fullDatabaseId: "3000000002" }] },
              },
            ],
          },
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    const resolved = await listReviewThreadResolution("t", "acme", "web", "7");
    expect(resolved.get("3000000001")).toBe(true);
    expect(resolved.get("3000000002")).toBe(false);
    expect(queryOf(fetchMock)).toContain("reviewThreads(last: 100)");
  });
});

describe("searchPullRequests", () => {
  const sentQuery = async (details?: boolean) => {
    const fetchMock = respond({ search: { nodes: [] } });
    vi.stubGlobal("fetch", fetchMock);
    await searchPullRequests("t", "is:pr", details);
    return queryOf(fetchMock);
  };

  it("asks for files, body, reviews and comment bodies only with details", async () => {
    const detailed = await sentQuery(true);
    for (const field of ["files(", "headRefOid", "reviews(", "comments(last"]) {
      expect(detailed).toContain(field);
    }
    const lean = await sentQuery();
    for (const field of ["files(", "headRefOid", "reviews(", "comments(last"]) {
      expect(lean).not.toContain(field);
    }
    expect(lean).toContain("comments { totalCount }");
  });

  it("asks who wrote the newest 100 comments", async () => {
    const detailed = await sentQuery(true);
    expect(detailed).toContain("comments(last: 100)");
    expect(detailed).toContain("authorAssociation");
    expect(detailed).toContain("author { __typename }");
  });
});
