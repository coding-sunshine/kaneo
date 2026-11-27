import type { FetchLike } from "@kaneo/importers";
import { createGuardedFetch } from "../../import/guarded-fetch";
import type { LinkPreview } from "./link-preview-type";
import { parseLinkPreview } from "./parse-link-preview";
import { previewFetch } from "./preview-fetch";

// The card should show within a few seconds of posting, so slow sites lose.
const TIMEOUT_MS = 2500;
// Titles and descriptions live in the head; never buffer a whole page.
const MAX_BYTES = 256 * 1024;

export type LinkPreviewResult =
  | { status: "ok"; preview: LinkPreview }
  | { status: "blocked" }
  | { status: "failed" };

async function readStart(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let html = "";
  let size = 0;
  try {
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      html += decoder.decode(value, { stream: true });
    }
    // One large chunk can overshoot the cap.
    return html.slice(0, MAX_BYTES);
  } finally {
    void reader.cancel().catch(() => {});
  }
}

export async function fetchLinkPreview(
  url: string,
  {
    baseFetch = previewFetch,
    timeoutMs = TIMEOUT_MS,
  }: { baseFetch?: FetchLike; timeoutMs?: number } = {},
): Promise<LinkPreviewResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The DNS preflight cannot be aborted, so the deadline races it too.
  const deadline = new Promise<LinkPreviewResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ status: "failed" });
    }, timeoutMs);
  });
  const guard = createGuardedFetch("Link preview", {
    cancelSignal: controller.signal,
    baseFetch,
  });
  const attempt = async (): Promise<LinkPreviewResult> => {
    const response = await guard.fetch(url, {
      headers: { accept: "text/html", "user-agent": "KaneoLinkPreview/1.0" },
      signal: controller.signal,
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.toLowerCase().includes("text/html")) {
      void response.body?.cancel().catch(() => {});
      return { status: "failed" };
    }
    const preview = parseLinkPreview(await readStart(response), url);
    return preview ? { status: "ok", preview } : { status: "failed" };
  };
  try {
    return await Promise.race([
      attempt().catch((): LinkPreviewResult =>
        guard.failure()?.kind === "destination"
          ? { status: "blocked" }
          : { status: "failed" },
      ),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
