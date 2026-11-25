import { useNavigate } from "@tanstack/react-router";
import {
  Box,
  Building2,
  Clock,
  Ellipsis,
  FolderInput,
  Link2,
  Lock,
  Pencil,
  Star,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import type { DocumentDetail } from "@/fetchers/document/documents";
import {
  useDeleteDocument,
  useRestoreDocument,
} from "@/hooks/mutations/document/use-document-mutations";
import { useFavorite } from "@/hooks/queries/favorite/use-favorites";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useGetWorkProjects } from "@/hooks/queries/work-project/use-get-work-projects";
import { toast } from "@/lib/toast";
import { type MoveLocation, MoveDocumentDialog } from "./move-document-dialog";
import { useCopyDocumentLink } from "./use-copy-document-link";

type DocumentOptionsMenuProps = {
  document: DocumentDetail;
  historyOpen: boolean;
  onRename: () => void;
  onShare: () => void;
  onToggleHistory: () => void;
};

/** The ··· menu next to a document's title, in Linear's order. */
export function DocumentOptionsMenu({
  document,
  historyOpen,
  onRename,
  onShare,
  onToggleHistory,
}: DocumentOptionsMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId, id } = document;
  const canEdit = document.role === "owner" || document.role === "edit";
  const { data: teams = [] } = useGetProjects({
    workspaceId,
    enabled: canEdit,
  });
  const { data: projects = [] } = useGetWorkProjects(workspaceId);
  const [target, setTarget] = useState<{
    location: MoveLocation;
    name: string;
  } | null>(null);
  const remove = useDeleteDocument(workspaceId);
  const restore = useRestoreDocument(workspaceId);
  const favorite = useFavorite(workspaceId, { type: "document", targetId: id });
  const copyLink = useCopyDocumentLink(workspaceId, id);

  const moveTo = (location: MoveLocation, name: string) =>
    setTarget({ location, name });

  const onDelete = () =>
    remove.mutate(id, {
      onSuccess: () => {
        navigate({
          to: "/dashboard/workspace/$workspaceId/documents",
          params: { workspaceId },
        });
        toast.success(t("navigation:documents.deleted"), {
          action: {
            label: t("navigation:documents.undo"),
            onClick: () =>
              restore.mutate(id, {
                onSuccess: () =>
                  toast.success(t("navigation:documents.restored")),
              }),
          },
        });
      },
      onError: (error) => toast.error(error.message),
    });

  return (
    <>
      <Menu>
        <MenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("navigation:documents.options")}
            />
          }
        >
          <Ellipsis aria-hidden />
        </MenuTrigger>
        <MenuPopup align="start" className="min-w-56">
          {canEdit && (
            <MenuSub>
              <MenuSubTrigger>
                <FolderInput aria-hidden />
                {t("navigation:documents.moveTo")}
              </MenuSubTrigger>
              <MenuSubPopup className="min-w-48">
                {document.role === "owner" && (
                  <MenuItem
                    onClick={() =>
                      moveTo(
                        { scope: "private" },
                        t("navigation:documents.scopes.private"),
                      )
                    }
                  >
                    <Lock aria-hidden />
                    {t("navigation:documents.scopes.private")}
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() =>
                    moveTo(
                      { scope: "workspace" },
                      t("navigation:documents.scopes.workspace"),
                    )
                  }
                >
                  <Building2 aria-hidden />
                  {t("navigation:documents.scopes.workspace")}
                </MenuItem>
                {teams.length > 0 && (
                  <MenuSub>
                    <MenuSubTrigger>
                      <Users aria-hidden />
                      {t("navigation:documents.scopes.teams")}
                    </MenuSubTrigger>
                    <MenuSubPopup className="max-h-80 min-w-48">
                      {teams.map((team) => (
                        <MenuItem
                          key={team.id}
                          onClick={() =>
                            moveTo(
                              { scope: "team", projectId: team.id },
                              team.name,
                            )
                          }
                        >
                          {team.name}
                        </MenuItem>
                      ))}
                    </MenuSubPopup>
                  </MenuSub>
                )}
                {projects.length > 0 && (
                  <MenuSub>
                    <MenuSubTrigger>
                      <Box aria-hidden />
                      {t("navigation:documents.scopes.projects")}
                    </MenuSubTrigger>
                    <MenuSubPopup className="max-h-80 min-w-48">
                      {projects.map((project) => (
                        <MenuItem
                          key={project.id}
                          onClick={() =>
                            moveTo(
                              { scope: "project", workProjectId: project.id },
                              project.name,
                            )
                          }
                        >
                          {project.name}
                        </MenuItem>
                      ))}
                    </MenuSubPopup>
                  </MenuSub>
                )}
              </MenuSubPopup>
            </MenuSub>
          )}
          {canEdit && (
            <MenuItem onClick={onRename}>
              <Pencil aria-hidden />
              {t("navigation:documents.rename")}
            </MenuItem>
          )}
          <MenuItem onClick={onShare}>
            <UserPlus aria-hidden />
            {t("navigation:documents.shareMenu")}
          </MenuItem>
          <MenuItem onClick={copyLink}>
            <Link2 aria-hidden />
            {t("navigation:documents.copyLink")}
          </MenuItem>
          <MenuItem onClick={favorite.toggle}>
            <Star aria-hidden />
            {favorite.isFavorite
              ? t("navigation:documents.unfavorite")
              : t("navigation:documents.favorite")}
          </MenuItem>
          <MenuItem onClick={onToggleHistory}>
            <Clock aria-hidden />
            {historyOpen
              ? t("navigation:documents.hideHistory")
              : t("navigation:documents.showHistory")}
          </MenuItem>
          {canEdit && (
            <>
              <MenuSeparator />
              <MenuItem variant="destructive" onClick={onDelete}>
                <Trash2 aria-hidden />
                {t("navigation:documents.delete")}
              </MenuItem>
            </>
          )}
        </MenuPopup>
      </Menu>
      {target && (
        <MoveDocumentDialog
          workspaceId={workspaceId}
          document={{ id, title: document.title }}
          target={target}
          onClose={() => setTarget(null)}
        />
      )}
    </>
  );
}
