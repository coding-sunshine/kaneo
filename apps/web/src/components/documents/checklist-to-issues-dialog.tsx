import type { Editor } from "@tiptap/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getInitialTaskColumn } from "@/components/shared/modals/initial-task-column";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DocumentDetail } from "@/fetchers/document/documents";
import useCreateTask from "@/hooks/mutations/task/use-create-task";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { useDocumentAudience } from "@/hooks/queries/document/use-documents";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { toast } from "@/lib/toast";
import {
  addIssueLinks,
  type ChecklistLine,
  type IssueLink,
} from "./checklist-issues";

type Props = {
  document: DocumentDetail;
  editor: Editor;
  lines: ChecklistLine[];
  onClose: () => void;
};

/**
 * Makes one issue per ticked checklist line. Before it does, it says when more
 * people can open the team's issues than can open this document.
 */
export function ChecklistToIssuesDialog({
  document,
  editor,
  lines,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { workspaceId, id } = document;
  const { data: teams = [] } = useGetProjects({ workspaceId });
  const [teamId, setTeamId] = useState(document.projectId ?? "");
  const [skipped, setSkipped] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const team = teams.find((row) => row.id === teamId);
  const audience = useDocumentAudience(
    workspaceId,
    id,
    teamId ? { scope: "team", projectId: teamId } : null,
  );
  const { refetch: loadColumns } = useGetColumns(teamId);
  const { mutateAsync: createTask } = useCreateTask();
  const chosen = lines.filter((line) => !skipped.includes(line.pos));
  const { current = [], proposed = null } = audience.data ?? {};
  const extra = (proposed ?? []).filter(
    (person) => !current.some((own) => own.userId === person.userId),
  ).length;

  const submit = async () => {
    if (!team) return;
    setBusy(true);
    const origin = window.location.origin;
    const made: IssueLink[] = [];
    try {
      const columns = await loadColumns();
      if (columns.isError || !columns.data) throw new Error("columns");
      const status = getInitialTaskColumn(columns.data)?.slug ?? "planned";
      for (const line of chosen) {
        const task = await createTask({
          title: line.title,
          description: `${origin}/dashboard/workspace/${workspaceId}/document/${id}`,
          userId: "",
          projectId: team.id,
          status,
          priority: "no-priority",
        });
        made.push({
          ...line,
          key: `${team.slug.toUpperCase()}-${task.number}`,
          url: `${origin}/dashboard/workspace/${workspaceId}/project/${team.id}/task/${task.id}`,
        });
      }
    } catch {
      // Reported below, with how many were made.
    }
    // The issues link back through their description when the page is gone.
    if (made.length && !editor.isDestroyed) addIssueLinks(editor, made);
    if (made.length === chosen.length) {
      toast.success(
        t("navigation:documents.checklist.done", { count: made.length }),
      );
      onClose();
    } else if (made.length) {
      toast.error(
        t("navigation:documents.checklist.partial", {
          done: made.length,
          total: chosen.length,
        }),
      );
      onClose();
    } else {
      toast.error(t("navigation:documents.checklist.failed"));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("navigation:documents.checklist.title")}</DialogTitle>
          <DialogDescription>
            {t("navigation:documents.checklist.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          {lines.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("navigation:documents.checklist.none")}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="font-medium text-sm">
                {t("navigation:documents.checklist.lines")}
              </p>
              {lines.map((line) => (
                <label
                  key={line.pos}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    aria-label={line.title}
                    checked={!skipped.includes(line.pos)}
                    onCheckedChange={(on) =>
                      setSkipped(
                        on
                          ? skipped.filter((pos) => pos !== line.pos)
                          : [...skipped, line.pos],
                      )
                    }
                  />
                  <span className="min-w-0 truncate">{line.title}</span>
                </label>
              ))}
            </div>
          )}
          <select
            value={teamId}
            aria-label={t("navigation:documents.checklist.team")}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            onChange={(event) => setTeamId(event.target.value)}
          >
            <option value="">
              {t("navigation:documents.checklist.chooseTeam")}
            </option>
            {teams.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          {team && audience.isError && (
            <p role="alert" className="text-destructive-foreground text-xs">
              {t("navigation:documents.checklist.audienceFailed")}
            </p>
          )}
          {team && extra > 0 && (
            <p role="status" className="text-warning-foreground text-xs">
              {t("navigation:documents.checklist.audience", {
                count: extra,
                team: team.name,
              })}
            </p>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!team || !proposed || chosen.length === 0 || busy}
            onClick={submit}
          >
            {t("navigation:documents.checklist.submit", {
              count: chosen.length,
            })}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
