import type { userProfileTable } from "../../database/schema";

export type ProfileRow = Pick<
  typeof userProfileTable.$inferSelect,
  | "jobTitle"
  | "department"
  | "location"
  | "timeZone"
  | "statusText"
  | "statusClearsAt"
  | "outOfOfficeFrom"
  | "outOfOfficeUntil"
>;

/**
 * What teammates see of a profile at `now`. A status or out-of-office range
 * that has ended reads as none, so nothing has to run to clear it.
 */
export function visibleProfile(row: Partial<ProfileRow> | null, now: Date) {
  const statusOn =
    row?.statusText && (!row.statusClearsAt || row.statusClearsAt > now);
  const awayOn =
    row?.outOfOfficeFrom && row.outOfOfficeUntil && row.outOfOfficeUntil > now;
  return {
    jobTitle: row?.jobTitle ?? null,
    department: row?.department ?? null,
    location: row?.location ?? null,
    timeZone: row?.timeZone ?? null,
    status: statusOn
      ? {
          text: row.statusText ?? "",
          clearsAt: row.statusClearsAt?.toISOString() ?? null,
        }
      : null,
    outOfOffice: awayOn
      ? {
          from: (row.outOfOfficeFrom as Date).toISOString(),
          until: (row.outOfOfficeUntil as Date).toISOString(),
        }
      : null,
  };
}
