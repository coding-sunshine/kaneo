import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { handOverDocuments } from "@/fetchers/document/documents";
import { documentsKey } from "@/hooks/queries/document/use-documents";
import { toast } from "@/lib/toast";
import { Button } from "../ui/button";

type Props = {
  workspaceId: string;
  /** The person who left, whose private documents move together. */
  fromUserId: string;
  fromName: string;
  members: { userId: string; name: string }[];
};

/** Give every private document of somebody who left to one colleague. */
function OwnerlessHandOver({
  workspaceId,
  fromUserId,
  fromName,
  members,
}: Props) {
  const { t } = useTranslation();
  const labelId = useId();
  const queryClient = useQueryClient();
  const [toUserId, setToUserId] = useState("");
  const { mutate, isPending } = useMutation({
    mutationFn: () => handOverDocuments(workspaceId, fromUserId, toUserId),
    onSuccess: ({ moved }) => {
      toast.success(
        t("team:membersTable.handOverDone", {
          count: moved,
          name: members.find((member) => member.userId === toUserId)?.name,
        }),
      );
      queryClient.invalidateQueries({ queryKey: documentsKey(workspaceId) });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-wrap items-center gap-2 pt-3">
      <span className="text-sm font-medium">
        {t("team:membersTable.ownerlessFrom", { name: fromName })}
      </span>
      <span id={labelId} className="sr-only">
        {t("team:membersTable.handOverLabel")}
      </span>
      <select
        aria-labelledby={labelId}
        value={toUserId}
        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
        onChange={(event) => setToUserId(event.target.value)}
      >
        <option value="">{t("team:membersTable.handOverLabel")}</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.name}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        size="xs"
        disabled={!toUserId || isPending}
        onClick={() => mutate()}
      >
        {t("team:membersTable.handOverGive")}
      </Button>
    </div>
  );
}

export default OwnerlessHandOver;
