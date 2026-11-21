import { Building2, Link2, Lock, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import type { DocumentDetail } from "@/fetchers/document/documents";
import {
  useShareDocument,
  useUpdateDocument,
} from "@/hooks/mutations/document/use-document-mutations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { toast } from "@/lib/toast";
import { DocumentAccessMenu } from "./document-access-menu";
import { DocumentPerson } from "./document-person";
import { useCopyDocumentLink } from "./use-copy-document-link";

type DocumentSharePopoverProps = {
  document: DocumentDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const section = "px-3 pt-3 pb-1 font-medium text-[11px] text-muted-foreground";

/** Linear's Share popover: people with access, general access, copy link. */
export function DocumentSharePopover({
  document,
  open,
  onOpenChange,
}: DocumentSharePopoverProps) {
  const { t } = useTranslation();
  const { workspaceId, id } = document;
  const { data: workspace } = useActiveWorkspace();
  const { data: users } = useGetActiveWorkspaceUsers(workspaceId);
  const share = useShareDocument(workspaceId, id);
  const update = useUpdateDocument(workspaceId, id);
  const copyLink = useCopyDocumentLink(workspaceId, id);
  const canManage = document.role === "owner" || document.role === "edit";

  const taken = new Set([
    document.creatorId,
    ...document.shares.map((s) => s.userId),
  ]);
  const candidates = (users?.members ?? []).filter(
    (member) => !taken.has(member.userId),
  );
  const onError = (error: Error) => toast.error(error.message);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={<Button variant="ghost" size="xs" className="gap-1.5" />}
      >
        {t("navigation:documents.share.title")}
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-80 p-0">
        <div className="flex items-center justify-between pe-2">
          <p className={section}>
            {t("navigation:documents.share.peopleWithAccess")}
          </p>
          {canManage && candidates.length > 0 && (
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("navigation:documents.share.addPeople")}
                    className="mt-2"
                  />
                }
              >
                <UserPlus aria-hidden />
              </MenuTrigger>
              <MenuPopup align="end" className="max-h-72 min-w-48">
                {candidates.map((member) => (
                  <MenuItem
                    key={member.userId}
                    onClick={() =>
                      share.mutate(
                        { userId: member.userId, access: "edit" },
                        { onError },
                      )
                    }
                  >
                    <DocumentPerson
                      name={member.user.name}
                      image={member.user.image ?? null}
                    />
                  </MenuItem>
                ))}
              </MenuPopup>
            </Menu>
          )}
        </div>
        <ul className="px-1">
          <li className="flex h-9 items-center justify-between gap-2 px-2">
            <DocumentPerson
              name={document.creatorName}
              image={document.creatorImage}
            />
            <span className="text-muted-foreground text-xs">
              {t("navigation:documents.share.owner")}
            </span>
          </li>
          {document.shares.map((person) => (
            <li
              key={person.userId}
              className="flex h-9 items-center justify-between gap-2 px-2"
            >
              <DocumentPerson name={person.name} image={person.image} />
              <DocumentAccessMenu
                value={person.access}
                readOnly={!canManage}
                onChange={(access) =>
                  share.mutate({ userId: person.userId, access }, { onError })
                }
                onRemove={() =>
                  share.mutate(
                    { userId: person.userId, access: null },
                    { onError },
                  )
                }
              />
            </li>
          ))}
        </ul>
        <p className={section}>
          {t("navigation:documents.share.generalAccess")}
        </p>
        <div className="flex h-10 items-center justify-between gap-2 px-3">
          {document.scope === "private" ? (
            <span className="flex items-center gap-2 text-[13px]">
              <Lock aria-hidden className="size-4 text-muted-foreground" />
              <span>
                {t("navigation:documents.share.private")}
                <span className="block text-muted-foreground text-xs">
                  {t("navigation:documents.share.privateHint")}
                </span>
              </span>
            </span>
          ) : (
            <>
              <span className="flex min-w-0 items-center gap-2 text-[13px]">
                <Building2
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="truncate">
                  {t("navigation:documents.share.everyoneIn", {
                    name:
                      document.scope === "workspace"
                        ? workspace?.name
                        : document.parentName,
                  })}
                </span>
              </span>
              <DocumentAccessMenu
                value={document.generalAccess}
                readOnly={!canManage}
                onChange={(generalAccess) =>
                  update.mutate({ generalAccess }, { onError })
                }
              />
            </>
          )}
        </div>
        <div className="flex justify-end border-border/60 border-t p-2">
          <Button variant="outline" size="xs" onClick={copyLink}>
            <Link2 aria-hidden />
            {t("navigation:documents.copyLink")}
          </Button>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
