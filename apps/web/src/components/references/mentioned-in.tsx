import { Link } from "@tanstack/react-router";
import { FileText, SquareCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReferenceTarget } from "@/fetchers/reference/get-references";
import { useReferences } from "@/hooks/queries/reference/use-references";
import { cn } from "@/lib/cn";

type MentionedInProps = {
  workspaceId: string;
  target: ReferenceTarget;
  className?: string;
};

/** The tickets and documents whose text names the target. Hidden when none. */
export function MentionedIn({
  workspaceId,
  target,
  className,
}: MentionedInProps) {
  const { t } = useTranslation();
  const { data } = useReferences(target);
  const references = data?.references ?? [];
  if (!references.length) return null;

  const linkClass =
    "flex min-h-8 min-w-0 items-center gap-2 rounded-md px-2 text-[13px] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {t("common:mentionedIn.title")}
      </h2>
      <ul className="flex flex-col">
        {references.map((reference) => (
          <li key={`${reference.kind}:${reference.id}`}>
            {reference.kind === "task" && reference.projectId ? (
              <Link
                to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                params={{
                  workspaceId,
                  projectId: reference.projectId,
                  taskId: reference.id,
                }}
                className={linkClass}
              >
                <SquareCheck
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                {reference.key && (
                  <span className="shrink-0 font-mono text-muted-foreground">
                    {reference.key}
                  </span>
                )}
                <span className="truncate">{reference.title}</span>
              </Link>
            ) : (
              <Link
                to="/dashboard/workspace/$workspaceId/document/$documentId"
                params={{ workspaceId, documentId: reference.id }}
                className={linkClass}
              >
                <FileText
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="truncate">{reference.title}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
