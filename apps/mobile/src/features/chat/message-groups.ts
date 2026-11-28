const RUN_MS = 5 * 60 * 1000;

/** Marks which messages start a run by one author, so the name shows once. */
export function groupMessages<
  T extends { userId: string | null; createdAt: string },
>(messages: T[]) {
  return messages.map((message, i) => {
    const prev = messages[i - 1];
    const gap = prev
      ? Date.parse(message.createdAt) - Date.parse(prev.createdAt)
      : Infinity;
    return {
      message,
      showAuthor: !prev || prev.userId !== message.userId || gap > RUN_MS,
    };
  });
}
