const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** How long ago something was opened, as a compact unit: "5m", "30h", "3d". */
export function formatAge(
  from: string | Date,
  now = Date.now(),
  locale?: string,
) {
  const ms = Math.max(0, now - new Date(from).getTime());
  const [unit, size] =
    ms < HOUR_MS
      ? (["minute", MINUTE_MS] as const)
      : ms < 2 * DAY_MS
        ? (["hour", HOUR_MS] as const)
        : (["day", DAY_MS] as const);
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "narrow",
  }).format(Math.floor(ms / size));
}
