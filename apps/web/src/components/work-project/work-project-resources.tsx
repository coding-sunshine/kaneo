import { Link } from "@tanstack/react-router";
import { FileText, Link2, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DocumentAccessLabel } from "@/components/documents/document-access-label";
import { useNewDocument } from "@/components/documents/use-new-document";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import type { WorkProjectLink } from "@/fetchers/work-project/types";
import { useDocuments } from "@/hooks/queries/document/use-documents";
import { WorkProjectLinkChip } from "./work-project-link-chip";
import { WorkProjectLinkDialog } from "./work-project-link-dialog";

type Props = {
  workspaceId: string;
  workProjectId: string;
  editable: boolean;
  links: WorkProjectLink[];
};

/** Linear's overview Resources row: the project's documents and links as chips, then "+". */
export function WorkProjectResources({
  workspaceId,
  workProjectId,
  editable,
  links,
}: Props) {
  const { t } = useTranslation();
  const { data: documents = [] } = useDocuments(workspaceId, { workProjectId });
  const newDocument = useNewDocument(workspaceId);
  const [linkOpen, setLinkOpen] = useState(false);
  const empty = documents.length === 0 && links.length === 0;
  if (!editable && empty) return null;

  return (
    <section className="flex min-h-7 flex-wrap items-center gap-x-1 gap-y-1 text-[13px]">
      <h2 className="mr-5 text-muted-foreground">
        {t("workspace:workProject.detail.resources")}
      </h2>
      {documents.map((document) => (
        <Link
          key={document.id}
          to="/dashboard/workspace/$workspaceId/document/$documentId"
          params={{ workspaceId, documentId: document.id }}
          className="flex h-6 max-w-74 items-center gap-1.5 rounded-full px-1.5 outline-none hover:bg-accent focus-visible:bg-accent"
        >
          <FileText
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <span className="truncate">
            {document.title || t("navigation:documents.untitled")}
          </span>
          <DocumentAccessLabel
            scope={document.scope}
            className="shrink-0 text-xs"
          />
        </Link>
      ))}
      {links.map((link) => (
        <WorkProjectLinkChip
          key={link.id}
          link={link}
          workProjectId={workProjectId}
          editable={editable}
        />
      ))}
      {editable && (
        <Menu>
          <MenuTrigger
            aria-label={t("settings:externalLinks.addResource")}
            title={t("settings:externalLinks.addResource")}
            className="flex h-6 items-center gap-1.5 rounded-md px-1.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            {empty && t("settings:externalLinks.addResource")}
          </MenuTrigger>
          <MenuPopup align="start" className="min-w-44">
            <MenuItem onClick={() => setLinkOpen(true)}>
              <Link2 aria-hidden="true" />
              {t("settings:externalLinks.addLink")}
            </MenuItem>
            <MenuItem
              disabled={newDocument.isPending}
              onClick={() => newDocument.create({ workProjectId })}
            >
              <FileText aria-hidden="true" />
              {t("settings:externalLinks.addDocument")}
            </MenuItem>
          </MenuPopup>
        </Menu>
      )}
      {linkOpen && (
        <WorkProjectLinkDialog
          workProjectId={workProjectId}
          onClose={() => setLinkOpen(false)}
        />
      )}
    </section>
  );
}
