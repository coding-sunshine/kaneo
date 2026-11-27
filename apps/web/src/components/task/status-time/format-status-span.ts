import { formatAge } from "@/lib/format-age";

/** Compact duration; seconds under a minute, since a quick move would read as "0m". */
export function formatStatusSpan(ms: number, locale?: string) {
  if (ms >= 60_000) return formatAge(new Date(0), ms, locale);
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "second",
    unitDisplay: "narrow",
  }).format(Math.floor(ms / 1000));
}
