export function parseTaskRouteFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(
      /\/dashboard\/workspace\/([^/]+)\/project\/([^/]+)\/task\/([^/]+)(?:\/|$)/i,
    );
    if (!match) return null;
    return {
      workspaceId: match[1],
      projectId: match[2],
      taskId: match[3],
    };
  } catch {
    return null;
  }
}
