import type { FetchLike } from "@kaneo/importers";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { fetchLinkPreview } from "./fetch-link-preview";

// Literal public addresses skip DNS, so these tests never touch the network.
const PUBLIC = "https://93.184.216.34/";
const page = `<title>Example Domain</title><p>For documentation examples.</p>`;
const html = (body: string, init: ResponseInit = {}) =>
  new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
const fake = (respond: (url: string) => Response) =>
  vi.fn<FetchLike>(async (url) => respond(url));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fetchLinkPreview", () => {
  it("returns the page title and description", async () => {
    const result = await fetchLinkPreview(PUBLIC, {
      baseFetch: fake(() => html(page)),
    });
    expect(result).toEqual({
      status: "ok",
      preview: {
        url: PUBLIC,
        title: "Example Domain",
        description: "For documentation examples.",
        siteName: "93.184.216.34",
      },
    });
  });

  it.each([
    "http://localhost:1337/",
    "http://127.0.0.1/",
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
  ])("blocks %s without sending a request", async (url) => {
    const baseFetch = fake(() => html(page));
    expect(await fetchLinkPreview(url, { baseFetch })).toEqual({
      status: "blocked",
    });
    expect(baseFetch).not.toHaveBeenCalled();
  });

  it("blocks private addresses even when webhooks may reach them", async () => {
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    expect(await fetchLinkPreview("http://10.0.0.5/")).toEqual({
      status: "blocked",
    });
  });

  it("blocks a redirect to a private address", async () => {
    const baseFetch = fake((url) =>
      url === PUBLIC
        ? new Response(null, {
            status: 302,
            headers: { location: "http://192.168.1.1/admin" },
          })
        : html(page),
    );
    expect(await fetchLinkPreview(PUBLIC, { baseFetch })).toEqual({
      status: "blocked",
    });
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it("skips responses that are not HTML", async () => {
    const baseFetch = fake(() =>
      html("{}", { headers: { "content-type": "application/json" } }),
    );
    expect(await fetchLinkPreview(PUBLIC, { baseFetch })).toEqual({
      status: "failed",
    });
  });

  it("skips error responses", async () => {
    const baseFetch = fake(() => html(page, { status: 500 }));
    expect(await fetchLinkPreview(PUBLIC, { baseFetch })).toEqual({
      status: "failed",
    });
  });

  it("gives up on a slow site", async () => {
    const baseFetch = vi.fn<FetchLike>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );
    expect(
      await fetchLinkPreview(PUBLIC, { baseFetch, timeoutMs: 20 }),
    ).toEqual({ status: "failed" });
  });

  it("gives up when the address lookup hangs", async () => {
    vi.doMock("node:dns/promises", () => ({
      lookup: () => new Promise(() => {}),
    }));
    vi.resetModules();
    const { fetchLinkPreview: fresh } = await import("./fetch-link-preview");
    const baseFetch = fake(() => html(page));
    const started = Date.now();
    expect(
      await fresh("https://slow-dns.example.test/", {
        baseFetch,
        timeoutMs: 50,
      }),
    ).toEqual({ status: "failed" });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(baseFetch).not.toHaveBeenCalled();
    vi.doUnmock("node:dns/promises");
    vi.resetModules();
  });

  it("reads only the start of a large page", async () => {
    const huge = `${page}${"<p>filler</p>".repeat(100_000)}`;
    const result = await fetchLinkPreview(PUBLIC, {
      baseFetch: fake(() => html(huge)),
    });
    expect(result).toMatchObject({
      status: "ok",
      preview: { title: "Example Domain" },
    });
  });
});
