export type OwnerMember = {
  userId: string;
  name: string;
  image: string | null;
};

/** A saved owner wins; otherwise the PR author's workspace member, when the login maps to one. */
export function toReviewOwner(
  override: OwnerMember | undefined,
  author: OwnerMember | undefined,
) {
  return {
    reviewOwner: override ?? author ?? null,
    originalAuthorUserId: author?.userId ?? null,
  };
}
