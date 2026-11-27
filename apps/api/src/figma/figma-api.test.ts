import { describe, expect, it, vi } from "vite-plus/test";
import { fetchFigmaFile } from "./figma-api";

const KEY = "AbCdEf0123456789xyzQrs";
const TOKEN = "figd_fake_token";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

// A stand-in for api.figma.com that answers by path.
function fakeFigma(routes: Record<string, () => Response>) {
  return vi.fn(async (input: string | URL, _init?: RequestInit) => {
    const url = new URL(String(input));
    const respond = routes[url.pathname];
    return respond ? respond() : json({ status: 404, err: "Not found" }, 404);
  });
}

describe("fetchFigmaFile", () => {
  it("reads a frame's name and rendered image", async () => {
    const fetch = fakeFigma({
      [`/v1/files/${KEY}/nodes`]: () =>
        json({
          name: "Checkout flow",
          thumbnailUrl: "https://figma-cdn.test/file-thumb.png",
          nodes: { "12:34": { document: { name: "Payment step" } } },
        }),
      [`/v1/images/${KEY}`]: () =>
        json({
          err: null,
          images: { "12:34": "https://figma-cdn.test/frame.png" },
        }),
    });

    const result = await fetchFigmaFile(
      { fileKey: KEY, nodeId: "12:34" },
      { token: TOKEN, fetch },
    );

    expect(result).toEqual({
      status: "ok",
      file: {
        fileName: "Checkout flow",
        frameName: "Payment step",
        thumbnailUrl: "https://figma-cdn.test/frame.png",
      },
    });
    for (const [input, init] of fetch.mock.calls) {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://api.figma.com");
      expect(new Headers(init?.headers).get("x-figma-token")).toBe(TOKEN);
    }
    const nodesUrl = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(nodesUrl.searchParams.get("ids")).toBe("12:34");
  });

  it("uses the file thumbnail when there is no frame", async () => {
    const fetch = fakeFigma({
      [`/v1/files/${KEY}`]: () =>
        json({
          name: "Design system",
          thumbnailUrl: "https://figma-cdn.test/file-thumb.png",
        }),
    });

    expect(
      await fetchFigmaFile(
        { fileKey: KEY, nodeId: null },
        { token: TOKEN, fetch },
      ),
    ).toEqual({
      status: "ok",
      file: {
        fileName: "Design system",
        frameName: null,
        thumbnailUrl: "https://figma-cdn.test/file-thumb.png",
      },
    });
    expect(
      new URL(String(fetch.mock.calls[0]?.[0])).searchParams.get("depth"),
    ).toBe("1");
  });

  it("falls back to the file thumbnail when the frame image fails", async () => {
    const fetch = fakeFigma({
      [`/v1/files/${KEY}/nodes`]: () =>
        json({
          name: "Checkout flow",
          thumbnailUrl: "https://figma-cdn.test/file-thumb.png",
          nodes: { "12:34": { document: { name: "Payment step" } } },
        }),
      [`/v1/images/${KEY}`]: () => json({ err: "Render timeout" }, 500),
    });

    const result = await fetchFigmaFile(
      { fileKey: KEY, nodeId: "12:34" },
      { token: TOKEN, fetch },
    );
    expect(result).toMatchObject({
      status: "ok",
      file: { thumbnailUrl: "https://figma-cdn.test/file-thumb.png" },
    });
  });

  it("reports a file the token cannot open as not found", async () => {
    const fetch = fakeFigma({
      [`/v1/files/${KEY}`]: () => json({ status: 403, err: "Forbidden" }, 403),
    });
    expect(
      await fetchFigmaFile(
        { fileKey: KEY, nodeId: null },
        { token: TOKEN, fetch },
      ),
    ).toEqual({ status: "not_found" });
  });

  it("reports a missing frame as not found", async () => {
    const fetch = fakeFigma({
      [`/v1/files/${KEY}/nodes`]: () =>
        json({ name: "Checkout flow", nodes: { "12:34": null } }),
    });
    expect(
      await fetchFigmaFile(
        { fileKey: KEY, nodeId: "12:34" },
        { token: TOKEN, fetch },
      ),
    ).toEqual({ status: "not_found" });
  });

  it("reports server errors and network failures as failed", async () => {
    const down = fakeFigma({
      [`/v1/files/${KEY}`]: () => json({ err: "Oops" }, 500),
    });
    expect(
      await fetchFigmaFile(
        { fileKey: KEY, nodeId: null },
        { token: TOKEN, fetch: down },
      ),
    ).toEqual({ status: "failed" });

    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(
      await fetchFigmaFile(
        { fileKey: KEY, nodeId: null },
        { token: TOKEN, fetch: offline },
      ),
    ).toEqual({ status: "failed" });
  });

  it("drops a thumbnail that is not an https URL", async () => {
    const fetch = fakeFigma({
      [`/v1/files/${KEY}`]: () =>
        json({ name: "Design system", thumbnailUrl: "javascript:alert(1)" }),
    });
    expect(
      await fetchFigmaFile(
        { fileKey: KEY, nodeId: null },
        { token: TOKEN, fetch },
      ),
    ).toMatchObject({ file: { thumbnailUrl: null } });
  });
});
