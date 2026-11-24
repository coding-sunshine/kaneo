import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/ui/menu";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { useUpdateDocument } from "@/hooks/mutations/document/use-document-mutations";
import { toast } from "@/lib/toast";

type DocumentKind = DocumentDetail["kind"];

const KINDS: DocumentKind[] = [
  "unsorted",
  "decision",
  "proposal",
  "brainstorm",
  "reference",
];

type DocumentKindMenuProps = {
  document: Pick<DocumentDetail, "workspaceId" | "id" | "kind" | "role">;
};

/** What the document is for. A person who can edit it says so here. */
export function DocumentKindMenu({ document }: DocumentKindMenuProps) {
  const { t } = useTranslation();
  const { workspaceId, id, kind, role } = document;
  const update = useUpdateDocument(workspaceId, id);
  const label = t(`navigation:documents.kind.${kind}`);
  if (role !== "owner" && role !== "edit") {
    return <span className="px-2 text-muted-foreground text-xs">{label}</span>;
  }
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="gap-1 text-muted-foreground"
          />
        }
      >
        <span className="sr-only">{t("navigation:documents.kind.label")}</span>
        {label}
        <ChevronDown aria-hidden className="size-3" />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-36">
        <MenuRadioGroup
          value={kind}
          onValueChange={(next) =>
            update.mutate(
              { kind: next as DocumentKind },
              { onError: (error) => toast.error(error.message) },
            )
          }
        >
          {KINDS.map((option) => (
            <MenuRadioItem key={option} value={option}>
              {t(`navigation:documents.kind.${option}`)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}
