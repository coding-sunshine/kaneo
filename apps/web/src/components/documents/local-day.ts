/** The person's own calendar day as YYYY-MM-DD (toISOString would give UTC). */
export function localDay(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
