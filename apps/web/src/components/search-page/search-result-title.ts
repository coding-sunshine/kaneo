type TitledResult = { type: string; title: string; isDirect?: boolean };

/** A message is titled by its channel; a direct message has no name. */
export function searchResultTitle(item: TitledResult, directMessage: string) {
  if (item.type !== "message") return item.title;
  return item.isDirect ? directMessage : `#${item.title}`;
}

/** The line under the title: what the message said, or the description. */
export function searchResultDetail(item: {
  type: string;
  content?: string;
  description?: string;
}) {
  return item.type === "message" ? item.content : item.description;
}
