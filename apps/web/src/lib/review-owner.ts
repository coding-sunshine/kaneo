/** Unchecking, or picking the original author, goes back to the default, so nothing is stored. */
export const ownerSelection = (
  memberUserId: string,
  originalAuthorUserId: string | null,
  checked: boolean,
) => (!checked || memberUserId === originalAuthorUserId ? null : memberUserId);
