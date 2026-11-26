import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { FactConflict } from "@/fetchers/document/facts";
import { formatDateMedium } from "@/lib/format";
import { DecideConflictDialog } from "./decide-conflict-dialog";

export type FactConflictCardProps = {
  workspaceId: string;
  documentId: string;
  conflict: FactConflict;
  /** The viewer decides for the topic. */
  canDecide: boolean;
  deciderName: string | null;
};

/** One fact where this document and the current document say different things. */
export function FactConflictCard({
  workspaceId,
  documentId,
  conflict,
  canDecide,
  deciderName,
}: FactConflictCardProps) {
  const { t } = useTranslation();
  const [deciding, setDeciding] = useState(false);
  const open = conflict.status === "open";
  const title =
    conflict.current.documentTitle || t("navigation:documents.untitled");

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 p-2.5">
      <p className="font-medium text-[13px]">{conflict.slotName}</p>
      <div className="flex flex-col gap-0.5">
        <p className="text-muted-foreground text-xs">
          {t("navigation:documents.facts.conflict.thisDocument")}
        </p>
        <p className="text-[13px] text-foreground">{conflict.value}</p>
        <q className="text-muted-foreground text-xs">{conflict.quote}</q>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-muted-foreground text-xs">
          <Link
            to="/dashboard/workspace/$workspaceId/document/$documentId"
            params={{ workspaceId, documentId: conflict.current.documentId }}
            className="text-info-foreground underline underline-offset-2"
          >
            {t("navigation:documents.facts.conflict.current", { title })}
          </Link>
        </p>
        <p className="text-[13px] text-foreground">{conflict.current.value}</p>
        <q className="text-muted-foreground text-xs">
          {conflict.current.quote}
        </q>
      </div>
      {!open && (
        <div className="text-xs">
          <p>
            {conflict.status === "tolerated" && conflict.tolerateUntil
              ? t("navigation:documents.facts.conflict.tolerated", {
                  date: formatDateMedium(conflict.tolerateUntil),
                })
              : t("navigation:documents.facts.conflict.settled")}
          </p>
          {conflict.reason && (
            <p className="text-muted-foreground">{conflict.reason}</p>
          )}
        </div>
      )}
      {canDecide ? (
        <Button
          size="xs"
          variant="outline"
          className="self-start"
          aria-label={
            open
              ? t("navigation:documents.facts.conflict.decideName", {
                  name: conflict.slotName,
                })
              : undefined
          }
          onClick={() => setDeciding(true)}
        >
          {t(
            open
              ? "navigation:documents.facts.conflict.decide"
              : "navigation:documents.facts.conflict.change",
          )}
        </Button>
      ) : (
        open && (
          <p className="text-muted-foreground text-xs">
            {deciderName
              ? t("navigation:documents.facts.conflict.askDecider", {
                  name: deciderName,
                })
              : t("navigation:documents.facts.conflict.askNoDecider")}
          </p>
        )
      )}
      {deciding && (
        <DecideConflictDialog
          workspaceId={workspaceId}
          documentId={documentId}
          conflict={conflict}
          onClose={() => setDeciding(false)}
        />
      )}
    </div>
  );
}
