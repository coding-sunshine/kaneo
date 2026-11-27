/** A chat message as a ticket comment: the text quoted, then a link back. */
export function messageTicketComment(body: string, link: string) {
  const quote = body
    .trim()
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
  return `${quote}\n\n[Open in chat](${link})`;
}
