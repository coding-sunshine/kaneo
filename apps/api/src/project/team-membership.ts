import type { projectMemberPreferenceTable } from "../database/schema";

type Row = Pick<
  typeof projectMemberPreferenceTable.$inferSelect,
  "leftAt" | "notifyIssueAdded" | "notifyIssueClosed" | "notifyIssueTriage"
>;

/** No preference row means a member with no subscriptions. */
export function toTeamMembership(row: Row | null | undefined) {
  return {
    joined: !row?.leftAt,
    notifyIssueAdded: row?.notifyIssueAdded ?? false,
    notifyIssueClosed: row?.notifyIssueClosed ?? false,
    notifyIssueTriage: row?.notifyIssueTriage ?? false,
  };
}
