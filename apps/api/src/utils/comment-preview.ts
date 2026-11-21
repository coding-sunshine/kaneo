/** First 160 characters of a comment as plain text; markup is dropped first so a cut can't land inside a tag. */
export function commentPreview(content: string): string {
  return content.replace(/<[^>]+>/g, "").slice(0, 160);
}
