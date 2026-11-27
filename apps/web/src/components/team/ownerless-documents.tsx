import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { takeOverDocument } from "@/fetchers/document/documents";
import {
  documentsKey,
  useOwnerlessDocuments,
} from "@/hooks/queries/document/use-documents";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Button } from "../ui/button";
import OwnerlessHandOver from "./ownerless-hand-over";

type Props = {
  workspaceId: string;
  /** The current members, who can receive a former member's documents. */
  members: { userId: string; name: string }[];
};

// Private documents whose author left. Render it for a workspace owner only:
// the list is refused to everybody else.
function OwnerlessDocuments({ workspaceId, members }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: documents = [] } = useOwnerlessDocuments(workspaceId);
  const { mutate: takeOver, isPending } = useMutation({
    mutationFn: (id: string) => takeOverDocument(workspaceId, id),
    onSuccess: () => {
      toast.success(t("team:membersTable.takeOverSuccess"));
      queryClient.invalidateQueries({ queryKey: documentsKey(workspaceId) });
    },
    onError: () => toast.error(t("team:membersTable.takeOverError")),
  });
  if (documents.length === 0) return null;
  // One hand-over per person who left. A deleted account has no one to name,
  // and a hand-over leaves what they threw away.
  const leavers = [
    ...new Map(
      documents.flatMap((document) =>
        document.creatorId && !document.deletedAt
          ? [[document.creatorId, document.creatorName ?? ""] as const]
          : [],
      ),
    ),
  ];

  return (
    <section className="mt-8 px-6" aria-labelledby="ownerless-documents-title">
      <h2 id="ownerless-documents-title" className="text-sm font-medium">
        {t("team:membersTable.ownerlessTitle")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("team:membersTable.ownerlessDescription")}
      </p>
      {leavers.map(([fromUserId, fromName]) => (
        <OwnerlessHandOver
          key={fromUserId}
          workspaceId={workspaceId}
          fromUserId={fromUserId}
          fromName={fromName}
          members={members}
        />
      ))}
      <ul className="mt-3 divide-y divide-border">
        {documents.map((document) => (
          <li
            key={document.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm">
                {document.title || t("navigation:documents.untitled")}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {formatDateMedium(document.updatedAt)}
                {document.deletedAt &&
                  ` · ${t("team:membersTable.ownerlessInTrash")}`}
              </div>
            </div>
            <Button
              variant="outline"
              size="xs"
              disabled={isPending}
              onClick={() => takeOver(document.id)}
            >
              {t("team:membersTable.takeOver")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default OwnerlessDocuments;
