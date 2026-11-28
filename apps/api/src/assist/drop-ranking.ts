// Words that compare people by how much they do. A bullet that uses them is
// dropped: AI summaries describe work, never rank the people doing it.
const RANKING =
  /\b(most|least|more|less)\s+(active|engaged|productive|responsive|involved)\b|\b(top|bottom)\s+(contributor|performer|poster)s?\b|\b(leaderboard|ranked|ranking)\b/i;

export const ranksPeople = (text: string) => RANKING.test(text);

export function dropRanking<T extends { text: string }>(bullets: T[]) {
  return bullets.filter((bullet) => !ranksPeople(bullet.text));
}
