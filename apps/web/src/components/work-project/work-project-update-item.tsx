import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  WorkProject,
  WorkProjectUpdate,
} from "@/fetchers/work-project/types";
import {
  useDeleteWorkProjectUpdate,
  useEditWorkProjectUpdate,
} from "@/hooks/mutations/work-project/use-work-project-mutations";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import { WorkProjectHealth } from "./work-project-health";

type Props = {
  update: WorkProjectUpdate;
  workspaceId: string;
  // Pulse shows which project each update belongs to and has no controls.
  showProject?: boolean;
};

export function WorkProjectUpdateItem({
  update,
  workspaceId,
  showProject,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = useWorkspacePermission();
  const { mutateAsync: edit } = useEditWorkProjectUpdate(update.workProjectId);
  const { mutateAsync: remove } = useDeleteWorkProjectUpdate(
    update.workProjectId,
  );
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(update.body);
  const isAuthor = Boolean(user?.id) && user?.id === update.userId;
  const fail = (error: unknown) =>
    toast.error(
      error instanceof Error
        ? error.message
        : t("workspace:workProject.updates.postError"),
    );

  return (
    <li className="space-y-1 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {showProject && (
          <Link
            to="/dashboard/workspace/$workspaceId/work-projects/$workProjectId"
            params={{ workspaceId, workProjectId: update.workProjectId }}
            className="font-medium text-foreground hover:underline"
          >
            {update.workProjectName}
          </Link>
        )}
        <WorkProjectHealth health={update.health as WorkProject["health"]} />
        <span>{update.userName}</span>
        <time dateTime={update.createdAt}>
          {new Date(update.createdAt).toLocaleDateString()}
        </time>
        {!showProject && (isAuthor || isAdmin) && (
          <span className="ml-auto flex gap-1">
            {isAuthor && (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t("workspace:workProject.updates.edit")}
                onClick={() => setEditing(true)}
              >
                <Pencil />
              </Button>
            )}
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t("workspace:workProject.updates.delete")}
              onClick={async () => {
                if (
                  !window.confirm(
                    t("workspace:workProject.updates.deleteConfirm"),
                  )
                )
                  return;
                try {
                  await remove(update.id);
                } catch (error) {
                  fail(error);
                }
              }}
            >
              <Trash2 />
            </Button>
          </span>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label={t("workspace:workProject.updates.edit")}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                try {
                  await edit({ id: update.id, body: body.trim() });
                  setEditing(false);
                } catch (error) {
                  fail(error);
                }
              }}
            >
              {t("workspace:workProject.updates.save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setBody(update.body);
                setEditing(false);
              }}
            >
              {t("workspace:workProject.updates.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        update.body && (
          <p className="whitespace-pre-wrap text-sm">{update.body}</p>
        )
      )}
    </li>
  );
}
