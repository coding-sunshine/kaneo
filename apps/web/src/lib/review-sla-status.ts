import type { SlaStatus } from "./sla-status";

const HOUR_MS = 3_600_000;

/**
 * A design review is due two days after the request, so the issue SLA's
 * week-long thresholds would flag every fresh request. Risk shows only in
 * the last day before the due time.
 */
export function getReviewSlaStatus(
  slaDueAt: string | null | undefined,
  now = Date.now(),
): SlaStatus | null {
  if (!slaDueAt) return null;
  const left = new Date(slaDueAt).getTime() - now;
  if (left <= 0) return "breached";
  if (left <= 6 * HOUR_MS) return "high";
  if (left <= 24 * HOUR_MS) return "medium";
  return null;
}
