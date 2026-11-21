import type { DocumentComment } from "@/fetchers/document/documents";

/** Root comments in order, and each root's replies. */
export function groupDocumentThreads(comments: DocumentComment[]) {
  const replies = new Map<string, DocumentComment[]>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    replies.set(comment.parentId, [
      ...(replies.get(comment.parentId) ?? []),
      comment,
    ]);
  }
  const roots = comments.filter((comment) => !comment.parentId);
  return { roots, replies };
}
