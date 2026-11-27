import { useNavigate } from "@tanstack/react-router";
import {
  FileText,
  FolderKanban,
  Hash,
  MessageSquare,
  Search,
  Users,
  Zap,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from "@/components/ui/command";
import { DocumentAccessLabel } from "@/components/documents/document-access-label";
import { STATUS_TONE } from "@/components/documents/document-status-tone";
import { Badge } from "@/components/ui/badge";
import useGlobalSearch from "@/hooks/queries/search/use-global-search";
import type { DocumentScope } from "@/fetchers/document/documents";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

type SearchResultItem = {
  id: string;
  title: string;
  description?: string;
  content?: string;
  type: "task" | "project" | "workspace" | "comment" | "activity" | "document";
  projectName?: string;
  taskId?: string;
  projectId?: string;
  workspaceId?: string;
  taskNumber?: number;
  projectSlug?: string;
  priority?: string;
  status?: string;
  topicName?: string;
  scope?: DocumentScope;
  parentName?: string | null;
  archivedAt?: string | null;
};

const isDocumentStatus = (
  status: string | undefined,
): status is keyof typeof STATUS_TONE =>
  status !== undefined && status in STATUS_TONE;

type SearchGroup = {
  value: string;
  label: string;
  items: SearchResultItem[];
};

type SearchCommandMenuProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

function SearchCommandMenu({ open, setOpen }: SearchCommandMenuProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const { data: workspace } = useActiveWorkspace();
  const navigate = useNavigate();

  const searchEnabled = query.trim().length >= 3;

  const { data: searchResults } = useGlobalSearch({
    q: query,
    type: "all",
    workspaceId: workspace?.id,
    limit: 20,
  });

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const handleSelect = (item: SearchResultItem) => {
    setOpen(false);
    setQuery("");

    switch (item.type) {
      case "task":
        if (item.projectId && item.id && workspace?.id) {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              workspaceId: workspace.id,
              projectId: item.projectId,
              taskId: item.id,
            },
          });
        }
        break;
      case "project":
        if (item.id && workspace?.id) {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
            params: {
              workspaceId: workspace.id,
              projectId: item.id,
            },
          });
        }
        break;
      case "workspace":
        if (item.id) {
          navigate({
            to: "/dashboard/workspace/$workspaceId",
            params: {
              workspaceId: item.id,
            },
          });
        }
        break;
      case "document":
        if (workspace?.id) {
          navigate({
            to: "/dashboard/workspace/$workspaceId/document/$documentId",
            params: { workspaceId: workspace.id, documentId: item.id },
          });
        }
        break;
      case "comment":
      case "activity":
        if (item.projectId && item.taskId && workspace?.id) {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              workspaceId: workspace.id,
              projectId: item.projectId,
              taskId: item.taskId,
            },
          });
        }
        break;
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "task":
        return Hash;
      case "project":
        return FolderKanban;
      case "workspace":
        return Users;
      case "comment":
        return MessageSquare;
      case "activity":
        return Zap;
      case "document":
        return FileText;
      default:
        return FileText;
    }
  };

  const groupedItems = useMemo<SearchGroup[]>(() => {
    if (!searchEnabled) return [];
    const results = (searchResults?.results ?? []) as SearchResultItem[];
    const grouped = results.reduce(
      (acc: Record<string, SearchResultItem[]>, item: SearchResultItem) => {
        if (!acc[item.type]) acc[item.type] = [];
        acc[item.type].push(item);
        return acc;
      },
      {} as Record<string, SearchResultItem[]>,
    );

    const groupLabel = (type: string) => {
      switch (type as SearchResultItem["type"]) {
        case "task":
          return t("navigation:search.groups.task");
        case "project":
          return t("navigation:search.groups.project");
        case "workspace":
          return t("navigation:search.groups.workspace");
        case "comment":
          return t("navigation:search.groups.comment");
        case "activity":
          return t("navigation:search.groups.activity");
        case "document":
          return t("navigation:search.groups.document");
        default:
          return t("navigation:search.groups.fallback");
      }
    };

    return Object.entries(grouped).map(([type, items]) => ({
      value: type,
      label: groupLabel(type),
      items,
    }));
  }, [searchEnabled, searchResults?.results, t]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandDialogPopup instant>
        <Command items={groupedItems} filter={null}>
          <CommandInput
            placeholder={t("navigation:search.inputPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <CommandPanel>
            <CommandEmpty>
              <div className="text-center py-6">
                <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {searchEnabled
                    ? t("navigation:commandPalette.empty")
                    : t("navigation:search.minCharsHint")}
                </p>
              </div>
            </CommandEmpty>
            <CommandList>
              {(group: SearchGroup, groupIndex: number) => (
                <Fragment key={group.value}>
                  <CommandGroup items={group.items}>
                    <CommandGroupLabel>{group.label}</CommandGroupLabel>
                    <CommandCollection>
                      {(item: SearchResultItem) => {
                        const Icon = getItemIcon(item.type);
                        return (
                          <CommandItem
                            key={`${item.type}-${item.id}`}
                            value={`${item.title} ${item.description || ""} ${item.type} ${item.id}`}
                            onClick={() => handleSelect(item)}
                            className="flex items-start gap-3 py-3"
                            aria-label={`${item.type}: ${item.title}`}
                          >
                            <Icon
                              className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0"
                              aria-hidden="true"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex min-w-0 items-center gap-2 font-medium text-sm">
                                <span className="truncate">{item.title}</span>
                                {item.type === "document" &&
                                  isDocumentStatus(item.status) && (
                                    <Badge
                                      variant={STATUS_TONE[item.status]}
                                      size="sm"
                                      className="shrink-0 font-normal"
                                    >
                                      {t(
                                        `navigation:documents.status.${item.status}`,
                                      )}
                                    </Badge>
                                  )}
                                {item.type === "document" && item.scope && (
                                  <DocumentAccessLabel
                                    scope={item.scope}
                                    parentName={item.parentName}
                                    className="max-w-32 shrink-0 font-normal text-xs"
                                  />
                                )}
                                {item.archivedAt && (
                                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-normal text-[10px] text-muted-foreground">
                                    {t("tasks:detail.archived.badge")}
                                  </span>
                                )}
                              </div>
                              {item.type === "document" && item.topicName && (
                                <div className="text-xs text-muted-foreground truncate mt-1">
                                  {item.topicName}
                                </div>
                              )}
                              {item.description && (
                                <div className="text-xs text-muted-foreground truncate mt-1">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </CommandItem>
                        );
                      }}
                    </CommandCollection>
                  </CommandGroup>
                  {groupIndex < groupedItems.length - 1 && <CommandSeparator />}
                </Fragment>
              )}
            </CommandList>
          </CommandPanel>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}

export default SearchCommandMenu;
