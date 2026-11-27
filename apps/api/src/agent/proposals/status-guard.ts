const words = (value: string) =>
  ` ${value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

/**
 * Whether the person's own message names `status`. A status change must come
 * from the person: ticket text the agent read cannot ask for one.
 */
export function asksForStatus(message: string, status: string): boolean {
  const target = words(status).trim();
  return target.length > 0 && words(message).includes(` ${target} `);
}
