export function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isYouTubeUrl(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, "");
    return (
      host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be"
    );
  } catch {
    return false;
  }
}

export function extractIssueKeyFromUrl(value: string) {
  try {
    const parsed = new URL(value);
    const pathMatch = parsed.pathname.match(/\/issue\/([A-Za-z]+-\d+)(?:\/|$)/);
    if (pathMatch?.[1]) return pathMatch[1].toUpperCase();
  } catch {
    return null;
  }

  return null;
}

/** The workspace and the document an address points to, if it is a document's. */
export function extractDocumentLinkFromUrl(value: string) {
  try {
    const match = new URL(value).pathname.match(
      /\/workspace\/([^/]+)\/document\/([a-z0-9]+)\/?$/,
    );
    if (match?.[1] && match[2])
      return { workspaceId: match[1], documentId: match[2] };
  } catch {
    return null;
  }

  return null;
}

export function extractTaskIdFromUrl(value: string) {
  try {
    const parsed = new URL(value);
    const match = parsed.pathname.match(/\/task\/([a-z0-9]+)(?:\/|$)/i);
    if (match?.[1]) return match[1];
  } catch {
    return null;
  }

  return null;
}
