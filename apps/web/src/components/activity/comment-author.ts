type CommentAuthorSource = {
  userId: string | null;
  externalSource?: string | null;
  externalUserName?: string | null;
  externalUserAvatar?: string | null;
};

type Member = {
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
};

/**
 * Who a comment shows as written by. Imported comments keep the original
 * author's name and avatar; the workspace member who imported them is named
 * separately (GitHub comments are synced, not imported by a person).
 */
export function commentAuthor(
  comment: CommentAuthorSource,
  members: Member[] | undefined,
  labels: { someone: string; externalUser: string },
) {
  const member = comment.userId
    ? members?.find((candidate) => candidate.user?.id === comment.userId)?.user
    : undefined;
  const memberName = member?.name || labels.someone;

  if (comment.externalSource) {
    return {
      user: {
        id: undefined,
        name: comment.externalUserName ?? labels.externalUser,
        email: undefined,
        image: comment.externalUserAvatar ?? undefined,
      },
      importedBy:
        comment.userId && comment.externalSource !== "github"
          ? memberName
          : undefined,
    };
  }

  return {
    user: {
      id: member?.id,
      name: member?.name,
      email: member?.email,
      image: member?.image,
    },
    importedBy: undefined,
  };
}
