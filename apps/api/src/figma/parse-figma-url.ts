export type FigmaLink = {
  fileKey: string;
  nodeId: string | null;
  url: string;
};

const HOSTS = new Set(["figma.com", "www.figma.com"]);
const KINDS = new Set(["file", "design", "proto", "board", "slides"]);
const FILE_KEY = /^[A-Za-z0-9]{10,64}$/;
const NODE_ID = /^(\d+)[-:](\d+)$/;

/**
 * Reads the file key and frame id from a figma.com link. The server never
 * fetches the pasted URL itself; it builds api.figma.com requests from these.
 */
export function parseFigmaUrl(raw: string): FigmaLink | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    !HOSTS.has(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  )
    return null;

  const [kind, key, maybeBranch, branchKey] = url.pathname
    .split("/")
    .filter(Boolean);
  if (!kind || !KINDS.has(kind) || !key || !FILE_KEY.test(key)) return null;
  const fileKey =
    maybeBranch === "branch" && branchKey && FILE_KEY.test(branchKey)
      ? branchKey
      : key;

  const node = NODE_ID.exec(url.searchParams.get("node-id") ?? "");
  return {
    fileKey,
    nodeId: node ? `${node[1]}:${node[2]}` : null,
    url: url.toString(),
  };
}
