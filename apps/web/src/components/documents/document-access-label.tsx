import { Box, Building2, CircleDot, Lock, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DocumentScope } from "@/fetchers/document/documents";
import { cn } from "@/lib/cn";

const ICONS = {
  private: Lock,
  workspace: Building2,
  team: Users,
  project: Box,
  issue: CircleDot,
} as const satisfies Record<DocumentScope, unknown>;

type DocumentAccessLabelProps = {
  scope: DocumentScope;
  parentName?: string | null;
  className?: string;
};

/** Where a document lives and so who can open it, in a few words. */
export function DocumentAccessLabel({
  scope,
  parentName,
  className,
}: DocumentAccessLabelProps) {
  const { t } = useTranslation();
  const Icon = ICONS[scope];
  const kind = t(`navigation:documents.accessLabel.${scope}`);
  const named = scope !== "private" && scope !== "workspace" && parentName;
  return (
    <span
      title={t(`navigation:documents.accessLabel.hint.${scope}`)}
      className={cn(
        "inline-flex min-w-0 items-center gap-1 text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">
        {named ? (
          <>
            <span className="sr-only">{kind}: </span>
            {parentName}
          </>
        ) : (
          kind
        )}
      </span>
    </span>
  );
}
