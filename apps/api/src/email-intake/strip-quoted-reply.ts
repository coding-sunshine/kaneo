const QUOTE_START = [
  /^\s*On\b.*\bwrote:\s*$/i,
  /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i,
  /^\s*>/,
];

/** The new text of an emailed reply, without the message it quotes. */
export function stripQuotedReply(text: string) {
  const lines = text.split("\n");
  const cut = lines.findIndex((line) =>
    QUOTE_START.some((pattern) => pattern.test(line)),
  );
  return (cut >= 0 ? lines.slice(0, cut) : lines).join("\n").trim();
}
