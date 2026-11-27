import type { FigmaLink } from "./parse-figma-url";

export type FigmaFile = {
  fileName: string;
  frameName: string | null;
  thumbnailUrl: string | null;
};

export type FigmaFileResult =
  | { status: "ok"; file: FigmaFile }
  | { status: "not_found" }
  | { status: "failed" };

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const API = "https://api.figma.com/v1";
const TIMEOUT_MS = 5000;

class NotFound extends Error {}

function httpsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Reads a file's name and a thumbnail from the Figma REST API. A frame link
 * gets the frame rendered as PNG; without one, the file's own thumbnail.
 */
export async function fetchFigmaFile(
  { fileKey, nodeId }: Pick<FigmaLink, "fileKey" | "nodeId">,
  { token, fetch = globalThis.fetch }: { token: string; fetch?: FetchFn },
): Promise<FigmaFileResult> {
  const get = async (path: string, params: Record<string, string>) => {
    const url = new URL(`${API}${path}`);
    for (const [name, value] of Object.entries(params))
      url.searchParams.set(name, value);
    const response = await fetch(url.toString(), {
      headers: { "x-figma-token": token, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 403 || response.status === 404)
      throw new NotFound();
    if (!response.ok) throw new Error(`Figma answered ${response.status}`);
    return (await response.json()) as Record<string, unknown>;
  };
  const key = encodeURIComponent(fileKey);

  try {
    if (!nodeId) {
      const file = await get(`/files/${key}`, { depth: "1" });
      return {
        status: "ok",
        file: {
          fileName: String(file.name ?? ""),
          frameName: null,
          thumbnailUrl: httpsUrl(file.thumbnailUrl),
        },
      };
    }

    const file = await get(`/files/${key}/nodes`, { ids: nodeId, depth: "1" });
    const nodes = (file.nodes ?? {}) as Record<
      string,
      { document?: { name?: string } } | null
    >;
    const node = nodes[nodeId];
    if (!node) return { status: "not_found" };
    // The frame render is a nicety; the file thumbnail still makes a card.
    const frameImage = await get(`/images/${key}`, {
      ids: nodeId,
      format: "png",
      scale: "0.5",
    })
      .then((images) => (images.images as Record<string, unknown>)?.[nodeId])
      .catch(() => null);
    return {
      status: "ok",
      file: {
        fileName: String(file.name ?? ""),
        frameName: node.document?.name ?? null,
        thumbnailUrl: httpsUrl(frameImage) ?? httpsUrl(file.thumbnailUrl),
      },
    };
  } catch (error) {
    return error instanceof NotFound
      ? { status: "not_found" }
      : { status: "failed" };
  }
}
