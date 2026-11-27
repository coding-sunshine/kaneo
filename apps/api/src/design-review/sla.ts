// A design review should get an answer within two days of the request.
export const DESIGN_REVIEW_SLA_MS = 2 * 24 * 60 * 60 * 1000;

export function designReviewSlaDueAt(requestedAt: Date) {
  return new Date(requestedAt.getTime() + DESIGN_REVIEW_SLA_MS);
}
