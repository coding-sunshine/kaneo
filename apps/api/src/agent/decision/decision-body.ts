export type QuotedMessage = { name: string; text: string; url: string };

// Brackets would end the link text early.
const linkText = (text: string) => {
  const line = text.replace(/\s+/g, " ").replace(/[[\]]/g, "").trim();
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
};

/** The draft's Markdown: the decision, who took it, why, and the messages. */
export function decisionBody(input: {
  decision: string;
  deciderName: string | null;
  reason: string;
  messages: QuotedMessage[];
}) {
  return [
    `## Decision\n\n${input.decision}`,
    ...(input.deciderName ? [`**Decided by:** ${input.deciderName}`] : []),
    `**Reason:** ${input.reason}`,
    `## From the thread\n\n${input.messages
      .map((m) => `- [${linkText(`${m.name}: ${m.text}`)}](${m.url})`)
      .join("\n")}`,
  ].join("\n\n");
}
